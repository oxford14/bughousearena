import {
  addDoc,
  collection,
  deleteDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/config";
import type { VoiceSignal } from "@/types/firestore";

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

export class VoiceChatManager {
  private peers = new Map<string, RTCPeerConnection>();
  private localStream: MediaStream | null = null;
  private roomId: string;
  private uid: string;
  private unsubSignals: (() => void) | null = null;
  onRemoteStream?: (peerId: string, stream: MediaStream) => void;

  constructor(roomId: string, uid: string) {
    this.roomId = roomId;
    this.uid = uid;
  }

  async start(): Promise<void> {
    this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.unsubSignals = onSnapshot(
      query(
        collection(getFirebaseDb(), "voiceSignals", this.roomId, "candidates"),
        where("uid", "!=", this.uid)
      ),
      (snap) => {
        snap.docChanges().forEach((change) => {
          if (change.type === "added") {
            void this.handleSignal(change.doc.data() as VoiceSignal);
          }
        });
      }
    );
  }

  private async getOrCreatePeer(peerId: string): Promise<RTCPeerConnection> {
    if (this.peers.has(peerId)) return this.peers.get(peerId)!;

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.localStream?.getTracks().forEach((track) => {
      pc.addTrack(track, this.localStream!);
    });

    pc.ontrack = (event) => {
      this.onRemoteStream?.(peerId, event.streams[0]!);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        void this.sendSignal(peerId, "ice", { candidate: event.candidate.toJSON() });
      }
    };

    this.peers.set(peerId, pc);
    return pc;
  }

  async createOffer(peerId: string): Promise<void> {
    const pc = await this.getOrCreatePeer(peerId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await this.sendSignal(peerId, "offer", { sdp: offer.sdp! });
  }

  private async handleSignal(signal: VoiceSignal): Promise<void> {
    const pc = await this.getOrCreatePeer(signal.uid);

    if (signal.type === "offer" && signal.sdp) {
      await pc.setRemoteDescription({ type: "offer", sdp: signal.sdp });
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await this.sendSignal(signal.uid, "answer", { sdp: answer.sdp! });
    } else if (signal.type === "answer" && signal.sdp) {
      await pc.setRemoteDescription({ type: "answer", sdp: signal.sdp });
    } else if (signal.type === "ice" && signal.candidate) {
      await pc.addIceCandidate(signal.candidate);
    }
  }

  private async sendSignal(
    _peerId: string,
    type: VoiceSignal["type"],
    data: { sdp?: string; candidate?: RTCIceCandidateInit }
  ): Promise<void> {
    await addDoc(
      collection(getFirebaseDb(), "voiceSignals", this.roomId, "candidates"),
      {
        uid: this.uid,
        type,
        ...data,
        createdAt: serverTimestamp(),
      }
    );
  }

  toggleMute(muted: boolean): void {
    this.localStream?.getAudioTracks().forEach((t) => {
      t.enabled = !muted;
    });
  }

  async stop(): Promise<void> {
    this.unsubSignals?.();
    this.peers.forEach((pc) => pc.close());
    this.peers.clear();
    this.localStream?.getTracks().forEach((t) => t.stop());
    this.localStream = null;
  }
}

export async function cleanupVoiceSignals(roomId: string): Promise<void> {
  const snap = await getDocs(
    collection(getFirebaseDb(), "voiceSignals", roomId, "candidates")
  );
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
}

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

/**
 * Peer-to-peer voice for a single team. The `roomId` is team-scoped by the
 * caller (e.g. `${matchId}-team-${team}`) so signaling never reaches the
 * opposing team, and every signal is additionally addressed to a specific
 * teammate uid. As a result a player can only ever hear their own teammates.
 */
export class VoiceChatManager {
  private peers = new Map<string, RTCPeerConnection>();
  private pendingCandidates = new Map<string, RTCIceCandidateInit[]>();
  private localStream: MediaStream | null = null;
  private roomId: string;
  private uid: string;
  private unsubSignals: (() => void) | null = null;
  onRemoteStream?: (peerId: string, stream: MediaStream) => void;
  onPeerDisconnected?: (peerId: string) => void;

  constructor(roomId: string, uid: string) {
    this.roomId = roomId;
    this.uid = uid;
  }

  async start(): Promise<void> {
    this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Only react to signals explicitly addressed to this player within the team room.
    this.unsubSignals = onSnapshot(
      query(
        collection(getFirebaseDb(), "voiceSignals", this.roomId, "candidates"),
        where("to", "==", this.uid)
      ),
      (snap) => {
        snap.docChanges().forEach((change) => {
          if (change.type === "added") {
            void this.handleSignal(change.doc.data() as VoiceSignal);
          }
        });
      },
      (error) => {
        console.warn("[voice] signal listener error", error.code, error.message);
      }
    );
  }

  /**
   * Establish connections to the given teammate uids. A deterministic initiator
   * (lower uid offers) avoids both peers creating offers at once (glare).
   */
  async connectTo(peerIds: string[]): Promise<void> {
    for (const peerId of peerIds) {
      if (!peerId || peerId === this.uid || this.peers.has(peerId)) continue;
      if (this.uid < peerId) {
        await this.createOffer(peerId);
      } else {
        await this.getOrCreatePeer(peerId);
      }
    }
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

    pc.onconnectionstatechange = () => {
      if (["failed", "closed", "disconnected"].includes(pc.connectionState)) {
        this.onPeerDisconnected?.(peerId);
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
      await this.flushPendingCandidates(signal.uid, pc);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await this.sendSignal(signal.uid, "answer", { sdp: answer.sdp! });
    } else if (signal.type === "answer" && signal.sdp) {
      await pc.setRemoteDescription({ type: "answer", sdp: signal.sdp });
      await this.flushPendingCandidates(signal.uid, pc);
    } else if (signal.type === "ice" && signal.candidate) {
      if (pc.remoteDescription) {
        await pc.addIceCandidate(signal.candidate).catch(() => {});
      } else {
        const queued = this.pendingCandidates.get(signal.uid) ?? [];
        queued.push(signal.candidate);
        this.pendingCandidates.set(signal.uid, queued);
      }
    }
  }

  private async flushPendingCandidates(
    peerId: string,
    pc: RTCPeerConnection
  ): Promise<void> {
    const queued = this.pendingCandidates.get(peerId);
    if (!queued?.length) return;
    for (const candidate of queued) {
      await pc.addIceCandidate(candidate).catch(() => {});
    }
    this.pendingCandidates.delete(peerId);
  }

  private async sendSignal(
    peerId: string,
    type: VoiceSignal["type"],
    data: { sdp?: string; candidate?: RTCIceCandidateInit }
  ): Promise<void> {
    await addDoc(
      collection(getFirebaseDb(), "voiceSignals", this.roomId, "candidates"),
      {
        uid: this.uid,
        to: peerId,
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
    this.pendingCandidates.clear();
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

import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { BACKEND_URL } from '../services/api';

interface UseDashboardSocketProps {
  onMapNew: (data: any) => void;
  onMapApproved: (data: any) => void;
  onEvidenceSubmitted: (data: any) => void;
  onValidationComplete: (data: any) => void;
  onDocumentNew: (data: any) => void;
  onDocumentStatus: (data: any) => void;
}

export function useDashboardSocket({
  onMapNew,
  onMapApproved,
  onEvidenceSubmitted,
  onValidationComplete,
  onDocumentNew,
  onDocumentStatus,
}: UseDashboardSocketProps) {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [wsLogs, setWsLogs] = useState<string[]>([]);

  // Keep references to latest callbacks to avoid triggering socket reconnections
  const callbacksRef = useRef({
    onMapNew,
    onMapApproved,
    onEvidenceSubmitted,
    onValidationComplete,
    onDocumentNew,
    onDocumentStatus,
  });

  useEffect(() => {
    callbacksRef.current = {
      onMapNew,
      onMapApproved,
      onEvidenceSubmitted,
      onValidationComplete,
      onDocumentNew,
      onDocumentStatus,
    };
  }, [
    onMapNew,
    onMapApproved,
    onEvidenceSubmitted,
    onValidationComplete,
    onDocumentNew,
    onDocumentStatus,
  ]);

  useEffect(() => {
    const clientSocket: Socket = io(BACKEND_URL);

    clientSocket.on('connect', () => {
      console.log('Dashboard Socket.io channel connected:', clientSocket.id);
      setIsConnected(true);
      clientSocket.emit('join:dashboard');
    });

    clientSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    clientSocket.on('map:new', (data: any) => {
      setWsLogs((prev) => [
        `[${new Date().toLocaleTimeString()}] EXTRACTED → MAP ${data.mapCode}`,
        ...prev,
      ]);
      callbacksRef.current.onMapNew(data);
    });

    clientSocket.on('map:approved', (data: any) => {
      setWsLogs((prev) => [
        `[${new Date().toLocaleTimeString()}] APPROVED → ${data.mapCode}`,
        ...prev,
      ]);
      callbacksRef.current.onMapApproved(data);
    });

    clientSocket.on('evidence:submitted', (data: any) => {
      setWsLogs((prev) => [
        `[${new Date().toLocaleTimeString()}] EVIDENCE → MAP ${data.mapId}`,
        ...prev,
      ]);
      callbacksRef.current.onEvidenceSubmitted(data);
    });

    clientSocket.on('validation:complete', (data: any) => {
      setWsLogs((prev) => [
        `[${new Date().toLocaleTimeString()}] VALIDATED → MAP ${data.mapId} [${data.verdict}]`,
        ...prev,
      ]);
      callbacksRef.current.onValidationComplete(data);
    });

    clientSocket.on('document:new', (data: any) => {
      setWsLogs((prev) => [
        `[${new Date().toLocaleTimeString()}] DISCOVERED → PDF "${data.title.slice(0, 30)}..."`,
        ...prev,
      ]);
      callbacksRef.current.onDocumentNew(data);
    });

    clientSocket.on('document:status', (data: any) => {
      setWsLogs((prev) => [
        `[${new Date().toLocaleTimeString()}] UPDATE → PDF status is now ${data.status}`,
        ...prev,
      ]);
      callbacksRef.current.onDocumentStatus(data);
    });

    return () => {
      clientSocket.disconnect();
    };
  }, []); // Run socket setup exactly once on mount

  return {
    isConnected,
    wsLogs,
  };
}

export interface Pin {
  id: string;
  x: number;
  y: number;
  text: string;
}

/** A red string between two pins (undirected). */
export interface Connection {
  from: string;
  to: string;
}

export interface Board {
  pins: Pin[];
  connections: Connection[];
}

export function emptyBoard(): Board {
  return { pins: [], connections: [] };
}

export function addPin(board: Board, text: string, x = 20, y = 20): Board {
  const pin: Pin = { id: crypto.randomUUID(), x, y, text };
  return { ...board, pins: [...board.pins, pin] };
}

export function movePin(board: Board, id: string, x: number, y: number): Board {
  return {
    ...board,
    pins: board.pins.map((p) => (p.id === id ? { ...p, x, y } : p)),
  };
}

export function setPinText(board: Board, id: string, text: string): Board {
  return {
    ...board,
    pins: board.pins.map((p) => (p.id === id ? { ...p, text } : p)),
  };
}

export function removePin(board: Board, id: string): Board {
  return {
    pins: board.pins.filter((p) => p.id !== id),
    // drop any string touching the removed pin
    connections: board.connections.filter((c) => c.from !== id && c.to !== id),
  };
}

/** Same pair regardless of order. */
function sameEdge(a: Connection, from: string, to: string): boolean {
  return (a.from === from && a.to === to) || (a.from === to && a.to === from);
}

export function isConnected(board: Board, from: string, to: string): boolean {
  return board.connections.some((c) => sameEdge(c, from, to));
}

/** Connect two distinct pins; idempotent (no duplicate / self edges). */
export function connect(board: Board, from: string, to: string): Board {
  if (from === to || isConnected(board, from, to)) return board;
  return { ...board, connections: [...board.connections, { from, to }] };
}

export function disconnect(board: Board, from: string, to: string): Board {
  return {
    ...board,
    connections: board.connections.filter((c) => !sameEdge(c, from, to)),
  };
}

/** Toggle the string between two pins. */
export function toggleConnection(board: Board, from: string, to: string): Board {
  return isConnected(board, from, to) ? disconnect(board, from, to) : connect(board, from, to);
}

export function serialize(board: Board): string {
  return JSON.stringify(board);
}

export function deserialize(raw: string): Board {
  try {
    const b = JSON.parse(raw) as Partial<Board>;
    return {
      pins: Array.isArray(b.pins) ? b.pins : [],
      connections: Array.isArray(b.connections) ? b.connections : [],
    };
  } catch {
    return emptyBoard();
  }
}

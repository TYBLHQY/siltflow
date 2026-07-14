declare module "ws" {
  const WebSocket: { new(url: string): WebSocket };
  export default WebSocket;
}

const webSocketsServerPort = 8000;
import { createServer } from "http";
import { v4 as uuidV4 } from "uuid";
import { server } from "websocket";

// http 서버 생성
const httpServer = createServer();
httpServer.listen(webSocketsServerPort);

// websocket 서버에 http 포트 연결
const wsServer = new server({ httpServer });

// 모든 활성 연결 이 객체에 유지
const clients = {};
// 편집기의 content가 유지
let content = null;

const sendMessage = json => {
  Object.keys(clients).map(client => {
    clients[client].sendUTF(json);
  });
};

const typesDef = {
  CONTENT_CHANGE: "contentchange"
};

/**
 * connection이 수락되면 어떻게 될까?
 *
 * connection을 설정하기 위해 일반 http 요청을 보내는 동안
 * - 클라이언트는 요청 헤더에 '*Sec-WebSocket-Key*'를 보냄
 * - 서버는 이 값을 인코딩 및 해시하고 미리 정의된 GUID를 추가함
 * - 서버에서 보낸 handshake의 '*Sec-WebSocket-Accept*에 생성된 값을 반영함
 *
 * - 요청이 서버에서 수락되면 handshake가 status code 101로 이행됨
 * - 브라우저에 status code 101 이외의 것이 표시되면 WebSocket 업그레이드가 실패한 것
 *
 * - '*Sec-WebSocket-Accept*' 헤더는 서버가 연결을 수락할지 여부를 나타냄
 * - 응답에 '*Upgrade*' 헤더가 없거나 '*Upgrade*'가 'websocket'이 아니면 webSocket 연결 실패
 */
wsServer.on("request", request => {
  // 브라우저에서 요청받을 때 고유한 사용자 아이디를 사용하여
  // 연결된 모든 클라이언트 객체를 유지
  const userId = uuidV4();
  console.log(
    `${new Date()}: Received a new connection from origin ${request.origin}.`
  );

  // 허용된 origin만 수락하도록 할수도 있음
  const connection = request.accept(null, request.origin);
  clients[userId] = connection;
  console.log(`connected: ${userId} in ${Object.getOwnPropertyNames(clients)}`);

  connection.on("message", message => {
    if (message.type === "utf8") {
      const dataFromClient = JSON.parse(message.utf8Data);
      const json = { type: dataFromClient.type };
      if (dataFromClient.type === typesDef.CONTENT_CHANGE) {
        content = dataFromClient.content;
        json.data = { content };
      }

      sendMessage(JSON.stringify(json));
    }
  });

  connection.on("close", connection => {
    console.log(`${new Date()}: Peer ${userId} disconnected`);
    if (clients[userId]) delete clients[userId];
  });
});

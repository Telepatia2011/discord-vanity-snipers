"use strict"; // Benim diye gezinirsiniz aslanlar @T'

const tls = require("tls");
const WebSocket = require("ws");
const extractJsonFromString = require("extract-json-from-string");

const tlsSocket = tls.connect({
  host: "canary.discord.com",
  port: 443
});

let vanity = {
  vanity: "",
  event: null
};

const guilds = {};

const token = "TOKEN";
const server = "SERVERID";
const channel = "KANALID";

tlsSocket.on("data", async (data) => {
  const ext = await extractJsonFromString(data.toString());
  if (!Array.isArray(ext)) {
    console.error("no array", ext);
    return;
  }
  const find = ext && (ext.find((e) => e.code) || ext.find((e) => e.message && e.message.toLowerCase().includes("rate")));
  if (find) {
    const requestBody = JSON.stringify({
      content: `@everyone ${vanity.vanity}\n\`\`\`json\n${JSON.stringify(find, null, 2)}\`\`\``,
    });
    const contentLength = Buffer.byteLength(requestBody);
    const requestHeader = [
      `POST /api/v7/channels/${channel}/messages HTTP/1.1`,
      `Host: canary.discord.com`,
      `Authorization: ${token}`,
      `Content-Type: application/json`,
      `Content-Length: ${contentLength}`
    ].join("\r\n");
    const request = requestHeader + "\r\n\r\n" + requestBody;
    tlsSocket.write(request);
  }
});

tlsSocket.on("error", (error) => {
  console.log('tls error', error);
  process.exit();
});

tlsSocket.on("end", () => {
  console.log("tls connection closed");
  process.exit();
});

tlsSocket.on("secureConnect", () => {
  const websocket = new WebSocket("wss://gateway.discord.gg/");
  websocket.onclose = (event) => {
    console.log(`ws connection closed ${event.reason} ${event.code}`);
    process.exit();
  };

  websocket.onmessage = async (message) => {
    const { d, op, t } = JSON.parse(message.data);
    if (t == "GUILD_UPDATE") {
      const find = guilds[d.guild_id];
      if (find && find !== d.vanity_url_code) {
        const requestBody = JSON.stringify({ code: find });
        const requestHeader = [
          `PATCH /api/v7/guilds/${server}/vanity-url HTTP/1.1`,
          `Host: canary.discord.com`,
          `Authorization: ${token}`,
          `Content-Type: application/json`,
          `Content-Length: ${Buffer.byteLength(requestBody)}`,
        ].join("\r\n");
        const request = requestHeader + "\r\n\r\n" + requestBody;
        tlsSocket.write(request);
        vanity.vanity = `${find}`;
      }
    } else if (t === "READY") {
      d.guilds.forEach((guild) => {
        if (guild.vanity_url_code) {
          guilds[guild.id] = guild.vanity_url_code;
        }
      });
      console.log(guilds);
    }

    if (op === 10) {
      websocket.send(JSON.stringify({
        op: 2,
        d: {
          token: token,
          intents: 513 << 0,
          properties: {
            os: "Linux",
            browser: "Firefox",
            device: "Firefox",
          },
        },
      }));

      setInterval(() => websocket.send(JSON.stringify({ op: 1, d: {}, s: null, t: "heartbeat" })), d.heartbeat_interval);
    } else if (op === 7) {
      process.exit();
    }
  };
});

setInterval(() => {
  tlsSocket.write("GET / HTTP/1.1\r\nHost: canary.discord.com\r\n\r\n");
}, 400);

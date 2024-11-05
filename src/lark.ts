import * as lark from "@larksuiteoapi/node-sdk";

const client = new lark.Client({
  appId: process.env.APP_ID,
  appSecret: process.env.APP_SECRET,
});

async function send_msg(chat_id: string, message: string) {
  client.im.message
    .create({
      params: {
        receive_id_type: "chat_id",
      },
      data: {
        receive_id: chat_id,
        content: JSON.stringify({ text: message }),
        msg_type: "text",
      },
    })
    .catch((e) => {
      console.error(JSON.stringify(e.response.data, null, 4));
    });
}

export default send_msg;
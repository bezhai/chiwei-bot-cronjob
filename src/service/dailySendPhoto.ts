import dayjs from "dayjs";
import { getPixivImages, uploadToLark } from "../pixiv/pixivProxy";
import { StatusMode } from "../pixiv/types";
import { send_card } from "../lark";
import { calcBestChunks } from "../utils/calcPhoto";
import { LarkCard, CardHeader, ImgComponent, ColumnSet, Column, ActionComponent, ButtonComponent } from "feishu-card";

// 发图给订阅群聊
export const sendDailyPhoto = async (): Promise<void> => {
  let images = await getPixivImages({
    status: StatusMode.VISIBLE,
    page: 1,
    page_size: 1,
    random_mode: true,
  });

  images = await Promise.all(
    images.map(async (image) => {
      if (!image.image_key) {
        const uploadResp = await uploadToLark({ pixiv_addr: image.pixiv_addr });
        return { ...image, ...uploadResp };
      }
      return image;
    })
  );

  if (images.length <= 0) {
    return;
  }

  const card = new LarkCard(
    new CardHeader("今天的每日一图").color("green")
  ).addElements(new ImgComponent(images[0].image_key!, images[0].pixiv_addr));

  send_card("oc_0d2e26c81fdf0823997a7bb40d71dcc1", card);
};

// 发新图给特定群聊
export const dailySendNewPhoto = async (): Promise<void> => {
  let images = await getPixivImages({
    status: StatusMode.NOT_DELETE,
    page: 1,
    page_size: 6,
    random_mode: true,
    start_time: dayjs().add(-1, "day").valueOf(),
  });

  images = await Promise.all(
    images.map(async (image) => {
      if (!image.image_key) {
        const uploadResp = await uploadToLark({ pixiv_addr: image.pixiv_addr });
        return { ...image, ...uploadResp };
      }
      return image;
    })
  );

  if (images.length <= 0) {
    return;
  }

  const { chunks, weights } = calcBestChunks(images);

  const card = new LarkCard(
    new CardHeader("今日新图").color("green")
  ).addElements(
    new ColumnSet()
      .setHorizontalSpacing("small")
      .addColumn(
        new Column()
          .setWidth("weighted", weights[0])
          .addElements(
            ...chunks[0].map(
              (image) => new ImgComponent(image.image_key!, image.pixiv_addr)
            )
          )
      )
      .addColumn(
        new Column()
          .setWidth("weighted", weights[1])
          .addElements(
            ...chunks[1].map(
              (image) => new ImgComponent(image.image_key!, image.pixiv_addr)
            )
          )
      )
  ).addElements(
    new ActionComponent().addActions(
      new ButtonComponent().setText("换一批").addValue({
        type: "update-daily-photo-card",
        start_time: dayjs().add(-1, "day").valueOf(),
      }),
      new ButtonComponent().setText("查看详情").addValue({
        type: "fetch-photo-details",
        images: images.map((image) => image.pixiv_addr),
      })
    )
  );

  send_card("oc_a79ce7cc8cc4afdcfd519532d0a917f5", card);
};

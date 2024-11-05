import dayjs from "dayjs";
import { getPixivImages, uploadToLark } from "../pixiv/pixivProxy";
import { StatusMode } from "../pixiv/types";
import { LarkCard } from "../larkCard/card";
import { CardHeader } from "../larkCard/title";
import { ImgComponent } from "../larkCard/image";
import { send_card } from "../lark";
import { calcBestChunks } from "../utils/calc_photo";
import { Column, ColumnSet } from "../larkCard/column";

export const dailySendPhoto = async (): Promise<void> => {
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
  );

  send_card("oc_a79ce7cc8cc4afdcfd519532d0a917f5", card);
};

import dayjs from "dayjs";
import { getPixivImages, uploadToLark } from "../pixiv/pixivProxy";
import { StatusMode } from "../pixiv/types";
import { LarkCard } from "../larkCard/card";
import { Header } from "../larkCard/title";
import { ImgComponent } from "../larkCard/image";
import { send_card } from "../lark";

export const dailySendPhoto = async (): Promise<void> => {
  const images = await getPixivImages({
    status: StatusMode.NOT_DELETE,
    page: 1,
    page_size: 6,
    random_mode: true,
    start_time: dayjs().add(-1, "day").valueOf(),
  });

  for (let image of images) {
    if (!image.image_key) {
      const uploadResp = uploadToLark({ pixiv_addr: image.pixiv_addr });
      image = { ...image, ...uploadResp };
    }
  }

  if (images.length <= 0) {
    return;
  }

  const card = new LarkCard(new Header("今日新图")).addElements(
    ...images.map((image) => new ImgComponent(image.image_key!, ""))
  );

  send_card("oc_a79ce7cc8cc4afdcfd519532d0a917f5", card)
};

import dayjs from "dayjs";
import { getPixivImages } from "../pixiv/pixivProxy";
import { StatusMode } from "../pixiv/types";

export const dailySendPhoto = async (): Promise<void> => {
    const images = await getPixivImages({
        status: StatusMode.NOT_DELETE,
        page: 1,
        page_size: 6,
        random_mode: true,
        start_time: dayjs().add(-1, 'day').valueOf(),
    });

    for (let image of images) {
        if (!image.image_key) {
            
        }
    }
    
};
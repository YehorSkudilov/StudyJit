declare module "ytdl-max" {
  // basic shape to satisfy TS; adjust later if you want strict typing
  export default class YoutubeDownloader {
    static Video(): YoutubeDownloader;
    static Audio(): YoutubeDownloader;
    static LowerQualityVideos(): YoutubeDownloader;
    download(url: string): Promise<{ filename: string; path?: string }>;
  }
}

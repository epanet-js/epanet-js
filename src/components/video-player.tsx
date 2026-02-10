import React, { useRef, useState, useEffect } from "react";
import Hls from "hls.js";
import { Loading } from "src/components/elements";

export interface Caption {
  start: number;
  end: number;
  text: string;
}

interface VideoPlayerProps
  extends Omit<React.VideoHTMLAttributes<HTMLVideoElement>, "src"> {
  src: string;
  captions?: Caption[];
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  src,
  captions,
  className,
  ...videoAttributes
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      setIsLoading(false);
      injectCaptions(video, captions);
    };

    if (Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(src);
      hls.attachMedia(video);
      video.addEventListener("loadedmetadata", handleLoadedMetadata);

      return () => {
        video.removeEventListener("loadedmetadata", handleLoadedMetadata);
        hls.destroy();
      };
    }

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      video.addEventListener("loadedmetadata", handleLoadedMetadata);

      return () => {
        video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      };
    }

    return undefined;
  }, [src, captions]);

  return (
    <div className="relative w-full h-full">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loading />
        </div>
      )}
      <video
        ref={videoRef}
        className={className ?? "w-full h-full object-cover"}
        {...videoAttributes}
      />
    </div>
  );
};

function injectCaptions(video: HTMLVideoElement, captions?: Caption[]) {
  if (!captions || captions.length === 0) return;

  const track = video.addTextTrack("captions", "English", "en");
  track.mode = "showing";

  for (const caption of captions) {
    track.addCue(new VTTCue(caption.start, caption.end, caption.text));
  }
}

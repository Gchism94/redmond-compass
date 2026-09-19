export type InstallPlatform = "ios" | "android" | "desktop";
export type InstallDevice = "iphone" | "ipad" | "android" | "desktop";
export type InstallBrowser = "safari" | "chrome" | "edge" | "firefox" | "samsung" | "opera" | "other";

interface NavigatorLike {
  userAgent?: string;
  platform?: string;
  maxTouchPoints?: number;
  userAgentData?: {
    mobile?: boolean;
    platform?: string;
  };
}

export interface InstallEnvironment {
  platform: InstallPlatform;
  device: InstallDevice;
  browser: InstallBrowser;
  isMobile: boolean;
}

/**
 * Small, dependency-free platform classifier for install guidance. Capability
 * detection (`beforeinstallprompt`) still decides whether we can open a native
 * install dialog; this only chooses the correct manual fallback copy.
 */
export function detectInstallEnvironment(input?: NavigatorLike): InstallEnvironment {
  const nav: NavigatorLike | undefined = input ?? (
    typeof navigator !== "undefined" ? navigator as unknown as NavigatorLike : undefined
  );
  const ua = nav?.userAgent ?? "";
  const platform = nav?.userAgentData?.platform ?? nav?.platform ?? "";
  const touchPoints = nav?.maxTouchPoints ?? 0;

  const ipad = /ipad/i.test(ua) || (/mac/i.test(platform || ua) && touchPoints > 1);
  const iphone = /iphone|ipod/i.test(ua);
  const ios = ipad || iphone;
  const android = /android/i.test(ua) || /android/i.test(platform);

  let browser: InstallBrowser = "other";
  if (/edgios|edga|edg\//i.test(ua)) browser = "edge";
  else if (/samsungbrowser/i.test(ua)) browser = "samsung";
  else if (/opios|opr\//i.test(ua)) browser = "opera";
  else if (/crios|chrome|chromium/i.test(ua)) browser = "chrome";
  else if (/fxios|firefox/i.test(ua)) browser = "firefox";
  else if (/safari/i.test(ua)) browser = "safari";

  if (ios) {
    return { platform: "ios", device: ipad ? "ipad" : "iphone", browser, isMobile: true };
  }
  if (android) {
    return { platform: "android", device: "android", browser, isMobile: true };
  }
  return { platform: "desktop", device: "desktop", browser, isMobile: !!nav?.userAgentData?.mobile };
}

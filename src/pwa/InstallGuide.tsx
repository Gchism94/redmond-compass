import type { ReactNode } from "react";
import { Compass, Download, Monitor, MoreVertical, Plus, Share, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { useI18n, type DictKey } from "@/i18n";
import type { InstallBrowser, InstallDevice, InstallPlatform } from "./installEnvironment";

export interface InstallGuideProps {
  platform: InstallPlatform;
  device: InstallDevice;
  browser: InstallBrowser;
  canInstall: boolean;
  onInstall: () => void | Promise<void>;
  onContinue?: () => void;
}

export function installCtaKey(device: InstallDevice): DictKey {
  if (device === "iphone") return "landing.installCtaIphone";
  if (device === "ipad") return "landing.installCtaIpad";
  if (device === "android") return "landing.installCtaAndroid";
  return "landing.installCtaDesktop";
}

function guideTitleKey(device: InstallDevice): DictKey {
  if (device === "iphone") return "landing.installGuideIphone";
  if (device === "ipad") return "landing.installGuideIpad";
  if (device === "android") return "landing.installGuideAndroid";
  return "landing.installGuideDesktop";
}

function Step({ number, children }: { number: number; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
        {number}
      </span>
      <div className="min-h-8 pt-1 text-sm leading-6 text-card-foreground">{children}</div>
    </li>
  );
}

export function InstallGuideContent({ platform, device, browser, canInstall, onInstall, onContinue }: InstallGuideProps) {
  const { t } = useI18n();

  return (
    <div data-install-guide data-install-platform={platform} className="py-2">
      <div className="flex items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          <Compass size={24} />
        </span>
        <div>
          <h3 className="font-heading text-xl font-bold text-foreground">{t(guideTitleKey(device))}</h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {canInstall ? t("landing.installNativeReady") : t(platform === "ios" ? "landing.installIosIntro" : platform === "android" ? "landing.installAndroidIntro" : "landing.installDesktopIntro")}
          </p>
        </div>
      </div>

      {canInstall ? (
        <Button data-install-native type="button" size="lg" fullWidth className="mt-5" onClick={() => void onInstall()}>
          <Download size={18} /> {t("landing.installNow")}
        </Button>
      ) : platform === "ios" ? (
        <ol className="mt-5 space-y-4">
          <Step number={1}>
            <span className="inline-flex flex-wrap items-center gap-1.5">
              {t("landing.installIosStep1")} <Share size={16} className="text-primary" aria-hidden="true" />
            </span>
          </Step>
          <Step number={2}>
            <span className="inline-flex flex-wrap items-center gap-1.5">
              {t("landing.installIosStep2")} <span className="inline-flex items-center gap-1 font-semibold text-foreground"><Plus size={15} /> {t("pwa.addToHome")}</span>
            </span>
          </Step>
          <Step number={3}>
            {t("landing.installIosStep3")}
          </Step>
        </ol>
      ) : platform === "android" ? (
        <ol className="mt-5 space-y-4">
          <Step number={1}>
            <span className="inline-flex flex-wrap items-center gap-1.5">
              {t("landing.installAndroidStep1")} <MoreVertical size={17} className="text-primary" aria-hidden="true" />
            </span>
          </Step>
          <Step number={2}>{t("landing.installAndroidStep2")}</Step>
          <Step number={3}>{t("landing.installAndroidStep3")}</Step>
        </ol>
      ) : (
        <ol className="mt-5 space-y-4">
          <Step number={1}>{t("landing.installDesktopStep1")}</Step>
          <Step number={2}>{t("landing.installDesktopStep2")}</Step>
        </ol>
      )}

      {platform === "ios" && browser !== "safari" && (
        <p className="mt-5 rounded-lg bg-secondary px-3 py-2.5 text-xs leading-5 text-muted-foreground">
          {t("landing.installIosBrowserFallback")}
        </p>
      )}

      {onContinue && (
        <button type="button" onClick={onContinue} className="mt-4 inline-flex min-h-tap w-full items-center justify-center text-sm font-semibold text-positive">
          {t("landing.continueBrowser")}
        </button>
      )}
    </div>
  );
}

export function InstallGuideSheet({ open, onClose, ...guide }: InstallGuideProps & { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  return (
    <Sheet open={open} onClose={onClose} title={t("landing.installSheetTitle")}>
      <InstallGuideContent {...guide} onContinue={onClose} />
    </Sheet>
  );
}

export function InstallDeviceBadge({ device }: { device: InstallDevice }) {
  const { t } = useI18n();
  const Icon = device === "desktop" ? Monitor : Smartphone;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-pill bg-positive-tint px-3 py-1.5 text-xs font-semibold text-positive">
      <Icon size={13} /> {t(device === "iphone" ? "landing.detectedIphone" : device === "ipad" ? "landing.detectedIpad" : device === "android" ? "landing.detectedAndroid" : "landing.detectedDesktop")}
    </span>
  );
}

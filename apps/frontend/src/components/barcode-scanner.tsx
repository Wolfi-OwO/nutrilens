import { useEffect, useId, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { FormattedMessage, useIntl } from 'react-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// EAN-13 and UPC-A, the two formats the barcode lookup accepts (apps/api's route schema).
const BARCODE = /^\d{12,13}$/;

interface BarcodeScannerProps {
    /** Resolves with an error message to keep the dialog open, or null when the code was used. */
    onCode: (code: string) => Promise<string | null>;
    onClose: () => void;
}

// The camera is only requested after the person presses "Start camera", with a sentence of
// explanation first, because the browser prompt alone says nothing about why. Manual entry is
// always on screen: it is the fallback when permission is denied, there is no camera, or the
// code is too worn to scan. html5-qrcode is imported on demand so it never touches the main
// bundle.
export function BarcodeScanner({ onCode, onClose }: BarcodeScannerProps) {
    const intl = useIntl();
    const viewfinderId = useId().replace(/:/g, '');
    const [scanning, setScanning] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [manual, setManual] = useState('');
    const [busy, setBusy] = useState(false);
    const stopRef = useRef<(() => Promise<void>) | null>(null);
    const handledRef = useRef(false);

    const stop = async () => {
        const stopper = stopRef.current;
        stopRef.current = null;
        if (stopper) await stopper().catch(() => undefined);
    };

    const submit = async (code: string) => {
        if (!BARCODE.test(code)) {
            setMessage(intl.formatMessage({ id: 'barcode.unsupported' }));
            return;
        }
        setBusy(true);
        const error = await onCode(code);
        setBusy(false);
        if (error) {
            setMessage(error);
            handledRef.current = false;
        }
    };

    useEffect(() => {
        if (!scanning) return;
        let cancelled = false;
        void (async () => {
            try {
                const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');
                if (cancelled) return;
                const scanner = new Html5Qrcode(viewfinderId, {
                    formatsToSupport: [Html5QrcodeSupportedFormats.EAN_13, Html5QrcodeSupportedFormats.UPC_A],
                    verbose: false,
                });
                stopRef.current = async () => {
                    if (scanner.isScanning) await scanner.stop();
                    scanner.clear();
                };
                await scanner.start(
                    { facingMode: 'environment' },
                    { fps: 10, qrbox: { width: 260, height: 120 } },
                    (text) => {
                        // The decoder fires repeatedly while a code stays in view.
                        if (handledRef.current) return;
                        handledRef.current = true;
                        void submit(text.trim());
                    },
                    () => undefined,
                );
            } catch {
                if (!cancelled) {
                    setScanning(false);
                    setMessage(intl.formatMessage({ id: 'barcode.cameraDenied' }));
                }
            }
        })();
        return () => {
            cancelled = true;
            void stop();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- submit/intl are stable enough for one scan session
    }, [scanning]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="barcode-title"
                className="w-full max-w-md rounded-lg border border-border bg-background p-5 shadow-lg"
            >
                <div className="flex items-start justify-between gap-3">
                    <h2 id="barcode-title" className="font-display text-lg font-semibold text-foreground">
                        <FormattedMessage id="barcode.title" />
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label={intl.formatMessage({ id: 'barcode.close' })}
                        className="rounded-md p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        <X size={18} />
                    </button>
                </div>

                {!scanning ? (
                    <div className="mt-3 flex flex-col gap-3">
                        <p className="text-sm text-muted-foreground">
                            <FormattedMessage id="barcode.explain" />
                        </p>
                        <div>
                            <Button type="button" size="sm" onClick={() => setScanning(true)}>
                                <FormattedMessage id="barcode.start" />
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div id={viewfinderId} className="mt-3 overflow-hidden rounded-md bg-muted" />
                )}

                <form
                    className="mt-4 flex flex-col gap-1.5 border-t border-border pt-4"
                    onSubmit={(e) => {
                        e.preventDefault();
                        void submit(manual.trim());
                    }}
                >
                    <label htmlFor="barcode-manual" className="text-sm font-medium text-foreground">
                        <FormattedMessage id="barcode.manualLabel" />
                    </label>
                    <div className="flex gap-2">
                        <Input
                            id="barcode-manual"
                            inputMode="numeric"
                            autoComplete="off"
                            value={manual}
                            onChange={(e) => setManual(e.target.value)}
                        />
                        <Button type="submit" size="sm" disabled={busy || manual.trim().length === 0}>
                            <FormattedMessage id="barcode.lookup" />
                        </Button>
                    </div>
                </form>

                {message && (
                    <p role="alert" className="mt-3 text-sm text-destructive">
                        {message}
                    </p>
                )}
            </div>
        </div>
    );
}

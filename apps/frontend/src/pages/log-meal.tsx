import { useEffect, useMemo, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import type { Control } from 'react-hook-form';
import { FormattedMessage, FormattedNumber, useIntl } from 'react-intl';
import type { IntlShape } from 'react-intl';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router';
import {
    AlertTriangle,
    Aperture,
    ArrowLeft,
    Camera,
    Check,
    CheckCircle2,
    ImageOff,
    Loader2,
    Plus,
    Search,
    Trash2,
    WifiOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FoodSearchCombobox, type FoodSearchResult } from '@/components/food-search-combobox';
import { ShopPicker } from '@/components/shop-picker';
import { usePhotoPrediction } from '@/hooks/use-photo-prediction';
import { useActiveDietPlan } from '@/hooks/use-active-diet-plan';
import { useCreateMealLog, useMealLogs } from '@/hooks/use-meal-logs';
import { ApiError } from '@/lib/api-client';
import { isToday } from '@/lib/date-utils';
import { scaleToPortion } from '@/lib/portion-macros';
import { readShopMemory, rememberShop, type ShopSelection } from '@/lib/shop-memory';
import { cn } from '@/lib/utils';
import type { MealLogSource, PerHundredGramMacros, PhotoPrediction } from '@/types/api';

// Zod schema: form fields are coerced from strings (HTML inputs) to numbers.
// Number inputs with empty values send empty strings to the form, which zod's
// pipe and coerce converts and validates.
//
// Built per render from the active locale, not once at module scope: zod bakes
// each message into the schema when the schema is constructed, so a
// module-level schema would keep serving whichever language was active when
// this module was first evaluated. Same reasoning as login.tsx and plan.tsx.
function buildFormSchema(intl: IntlShape) {
    const itemSchema = z.object({
        foodName: z.string().min(1, intl.formatMessage({ id: 'logMeal.validation.foodName' })),
        portionGrams: z
            .string()
            .pipe(z.coerce.number())
            .pipe(z.number().positive(intl.formatMessage({ id: 'logMeal.validation.portion' }))),
        calories: z
            .string()
            .pipe(z.coerce.number())
            .pipe(z.number().nonnegative(intl.formatMessage({ id: 'logMeal.validation.calories' }))),
        // Each optional macro carries its own message. They used to share zod's
        // default ("Number must be greater than or equal to 0") and, worse, no
        // message was rendered at all: a negative protein value failed validation,
        // blocked the submit, and left the page looking like the button was dead.
        proteinGrams: z
            .string()
            .pipe(z.coerce.number())
            .pipe(
                z
                    .number()
                    .nonnegative(intl.formatMessage({ id: 'logMeal.validation.proteinNegative' })),
            )
            .optional(),
        carbGrams: z
            .string()
            .pipe(z.coerce.number())
            .pipe(
                z
                    .number()
                    .nonnegative(intl.formatMessage({ id: 'logMeal.validation.carbsNegative' })),
            )
            .optional(),
        fatGrams: z
            .string()
            .pipe(z.coerce.number())
            .pipe(
                z.number().nonnegative(intl.formatMessage({ id: 'logMeal.validation.fatNegative' })),
            )
            .optional(),
    });
    return z.object({ items: z.array(itemSchema).min(1) });
}

type FormValues = z.infer<ReturnType<typeof buildFormSchema>>;

// Form input type: HTML inputs send strings for all fields, including numeric ones.
// After zod validation, these are coerced to numbers (FormValues).
type FormInputs = {
    items: Array<{
        foodName: string;
        portionGrams: string;
        calories: string;
        proteinGrams?: string;
        carbGrams?: string;
        fatGrams?: string;
    }>;
};

// Empty strings render as empty in number inputs (not "0"), so users see a blank field
// rather than a prefilled zero. Validation via zod coercion catches empty string with
// a proper error message.
const EMPTY_ITEM: FormInputs['items'][0] = {
    foodName: '',
    portionGrams: '',
    calories: '',
};

function formatLabel(label: string): string {
    return label.replaceAll('_', ' ');
}

/** @returns The number a numeric form field holds, or 0 for an empty or unparseable one. */
function fieldNumber(value: string | undefined): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

// Prefills a single-item form from an AI prediction, including its per-100g
// macros (when the model returned any) scaled to a 100g default portion —
// previously applyPrediction only carried the food name across and silently
// dropped macros the API had already provided, forcing a re-type of numbers
// the AI had already estimated.
function buildItemFromPrediction(prediction: PhotoPrediction): FormInputs['items'][0] {
    const item: FormInputs['items'][0] = {
        ...EMPTY_ITEM,
        foodName: formatLabel(prediction.label),
        portionGrams: '100',
    };
    if (!prediction.macros) return item;
    const scaled = scaleToPortion(prediction.macros, 100);
    return {
        ...item,
        calories: scaled.calories !== null ? String(scaled.calories) : '',
        proteinGrams: scaled.proteinGrams !== null ? String(scaled.proteinGrams) : '',
        carbGrams: scaled.carbGrams !== null ? String(scaled.carbGrams) : '',
        fatGrams: scaled.fatGrams !== null ? String(scaled.fatGrams) : '',
    };
}

type Stage = 'idle' | 'analyzing' | 'reviewing';

// Two distinct causes land the user on the same manual-entry fallback (ADR-0003),
// but they are different situations — one means "try again later", the other
// means "this food isn't in the model's vocabulary" — so they get separate copy
// and icons rather than one generic "something went wrong" line.
type AiFallbackReason = 'unreachable' | 'not_recognized';

export default function LogMealPage() {
    const intl = useIntl();
    const navigate = useNavigate();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const [stage, setStage] = useState<Stage>('idle');
    const [source, setSource] = useState<MealLogSource>('manual_search');
    const [predictions, setPredictions] = useState<PhotoPrediction[] | null>(null);
    const [predictionsLowConfidence, setPredictionsLowConfidence] = useState(false);
    const [aiFallbackReason, setAiFallbackReason] = useState<AiFallbackReason | null>(null);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [needsPlan, setNeedsPlan] = useState(false);
    const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    // Read once per page visit, not per render: the memory only changes when
    // this page writes it (on a successful log), and re-reading localStorage on
    // every render would also re-run the shape validation for nothing.
    const [shopMemory] = useState(readShopMemory);
    const [shop, setShop] = useState<ShopSelection | null>(() => shopMemory.last);
    // Whether `shop` is still the untouched pre-fill. Drives the "remembered"
    // hint, which is the only thing telling the user why a shop is already
    // filled in — without it the pre-fill reads as the app inventing a fact.
    const [shopFromMemory, setShopFromMemory] = useState(shopMemory.last !== null);

    const photoPrediction = usePhotoPrediction();
    const createMealLog = useCreateMealLog();
    // Both already cached by the dashboard (staleTime 30s / 5min), so the
    // "what this does to today's total" line below costs no extra request in
    // the normal flow of dashboard → log a meal.
    const dietPlan = useActiveDietPlan();
    const mealLogs = useMealLogs();

    const caloriesSoFar = useMemo(
        () =>
            (mealLogs.data ?? [])
                .filter((log) => isToday(log.loggedAt))
                .reduce((total, log) => total + log.totalCalories, 0),
        [mealLogs.data],
    );

    // Revokes the PREVIOUS object URL whenever it changes, and the current
    // one on unmount — the cleanup closure captures whichever URL was current
    // when the effect last ran, so this never revokes a URL still in use.
    useEffect(() => {
        return () => {
            if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
        };
    }, [photoPreviewUrl]);

    const {
        control,
        register,
        handleSubmit,
        reset,
        setValue,
        getValues,
        formState: { errors, isSubmitting },
    } = useForm<FormInputs, unknown, FormValues>({
        // useForm's three type parameters: TFieldValues (inputs), TContext, TTransformedValues (outputs).
        // FormInputs is what HTML sends (strings), FormValues is what zod outputs (numbers).
        // The resolver handles the transformation during validation.
        resolver: zodResolver(buildFormSchema(intl)),
        defaultValues: { items: [EMPTY_ITEM] },
        // Validate when a field is left, not on every keystroke: a portion box
        // is invalid ("") the moment it is focused, and onChange validation
        // shouts at the user mid-typing. Re-validated on submit either way.
        mode: 'onBlur',
    });
    const { fields, append, remove } = useFieldArray({ control, name: 'items' });

    // Keyed by useFieldArray's stable field.id, not array index — index shifts
    // whenever an earlier row is removed, which would otherwise re-link the
    // wrong row's macros to a portion-size edit after a reorder.
    const catalogLinkRef = useRef<Record<string, PerHundredGramMacros>>({});
    const macrosLockedRef = useRef<Record<string, boolean>>({});

    // reset() always produces a brand-new field.id on the next render, so a
    // prediction's per-100g macros can't be linked to catalogLinkRef inline —
    // this effect picks up the freshly minted id as soon as it exists.
    const pendingLinkRef = useRef<PerHundredGramMacros | null>(null);
    useEffect(() => {
        if (pendingLinkRef.current && fields.length === 1) {
            catalogLinkRef.current[fields[0].id] = pendingLinkRef.current;
            macrosLockedRef.current[fields[0].id] = false;
            pendingLinkRef.current = null;
        }
    }, [fields]);

    const setMacroField = (
        index: number,
        field: 'calories' | 'proteinGrams' | 'carbGrams' | 'fatGrams',
        value: number | null,
    ) => {
        // null means USDA never reported this nutrient, not that it's zero —
        // an empty field says "unknown", a 0 would say "measured as none".
        setValue(`items.${index}.${field}`, value === null ? '' : String(value), {
            shouldDirty: true,
            shouldValidate: true,
        });
    };

    const handleFoodSelect = (index: number, fieldId: string, result: FoodSearchResult) => {
        const currentPortion = Number(getValues(`items.${index}.portionGrams`));
        // USDA reports macros per 100 g; that's the natural default portion
        // when the user hasn't already entered one for this row.
        const portionGrams = Number.isFinite(currentPortion) && currentPortion > 0 ? currentPortion : 100;
        const per100g: PerHundredGramMacros = {
            calories: result.caloriesKcal,
            proteinGrams: result.proteinGrams,
            carbGrams: result.carbGrams,
            fatGrams: result.fatGrams,
        };
        const scaled = scaleToPortion(per100g, portionGrams);

        setValue(`items.${index}.foodName`, result.description, { shouldDirty: true, shouldValidate: true });
        setValue(`items.${index}.portionGrams`, String(portionGrams), { shouldDirty: true, shouldValidate: true });
        setMacroField(index, 'calories', scaled.calories);
        setMacroField(index, 'proteinGrams', scaled.proteinGrams);
        setMacroField(index, 'carbGrams', scaled.carbGrams);
        setMacroField(index, 'fatGrams', scaled.fatGrams);
        setSource('manual_search');

        catalogLinkRef.current[fieldId] = per100g;
        macrosLockedRef.current[fieldId] = false;
    };

    const startManualEntry = () => {
        setSource('manual_search');
        setPredictions(null);
        setPredictionsLowConfidence(false);
        setAiFallbackReason(null);
        setPhotoPreviewUrl(null);
        reset({ items: [EMPTY_ITEM] });
        setStage('reviewing');
    };

    const handlePhotoSelected = async (file: File) => {
        setSubmitError(null);

        if (!file.type || !file.type.startsWith('image/')) {
            setSubmitError(intl.formatMessage({ id: 'logMeal.error.invalidImage' }));
            return;
        }

        const objectUrl = URL.createObjectURL(file);
        if (!objectUrl.startsWith('blob:')) {
            setSubmitError(intl.formatMessage({ id: 'logMeal.error.unsafePreview' }));
            return;
        }

        setPhotoPreviewUrl(objectUrl);
        setStage('analyzing');
        try {
            const result = await photoPrediction.mutateAsync(file);
            setSource('ai_photo');
            const top = result.predictions?.[0];

            if (result.available && top) {
                setPredictions(result.predictions ?? null);
                setPredictionsLowConfidence(result.isConfident === false);
                setAiFallbackReason(null);
                // If the prediction is low-confidence, don't pre-fill it into the form —
                // the user should deliberately choose from the options via applyPrediction,
                // not accidentally confirm a 26%-confidence guess. For confident predictions,
                // pre-fill the top result (name and macros) to reduce friction.
                if (result.isConfident !== false) {
                    pendingLinkRef.current = top.macros ?? null;
                    reset({ items: [buildItemFromPrediction(top)] });
                } else {
                    reset({ items: [EMPTY_ITEM] });
                }
            } else {
                // The graceful fallback from ADR-0003: the AI path didn't work this
                // time, so land on the same manual item form rather than a dead end.
                setPredictions(null);
                setPredictionsLowConfidence(false);
                setAiFallbackReason('not_recognized');
                reset({ items: [EMPTY_ITEM] });
            }
            setStage('reviewing');
        } catch {
            setPredictions(null);
            setPredictionsLowConfidence(false);
            setAiFallbackReason('unreachable');
            reset({ items: [EMPTY_ITEM] });
            setStage('reviewing');
        }
    };

    const applyPrediction = (prediction: PhotoPrediction) => {
        pendingLinkRef.current = prediction.macros ?? null;
        reset({ items: [buildItemFromPrediction(prediction)] });
    };

    const handleDiscard = () => {
        setStage('idle');
        setPredictions(null);
        setPredictionsLowConfidence(false);
        setAiFallbackReason(null);
        setPhotoPreviewUrl(null);
    };

    const handleDragOver = (event: React.DragEvent<HTMLButtonElement>) => {
        event.preventDefault();
        setIsDragging(true);
    };
    const handleDragLeave = (event: React.DragEvent<HTMLButtonElement>) => {
        event.preventDefault();
        setIsDragging(false);
    };
    const handleDrop = (event: React.DragEvent<HTMLButtonElement>) => {
        event.preventDefault();
        setIsDragging(false);
        const file = event.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) void handlePhotoSelected(file);
    };

    const onSubmit = async (values: FormValues) => {
        setSubmitError(null);
        setNeedsPlan(false);
        try {
            await createMealLog.mutateAsync({ source, items: values.items });
            // Written only after the log actually saved, and with whatever the
            // user ended up with — including null, which is them saying "not
            // the remembered shop this time" and clears the pre-fill.
            //
            // The shop is NOT sent to the API: meal_logs has no column for it
            // and POST /meal-logs would strip an unknown body field silently
            // (createMealLogBodySchema is a plain z.object). Sending it would
            // look saved and be lost.
            rememberShop(shop);
            void navigate('/');
        } catch (error) {
            if (error instanceof ApiError && error.status === 409) {
                setSubmitError(intl.formatMessage({ id: 'logMeal.error.needsPlan' }));
                setNeedsPlan(true);
            } else {
                setSubmitError(intl.formatMessage({ id: 'logMeal.error.saveFailed' }));
            }
        }
    };

    const renderAnalyzingStage = () => (
        <div
            role="status"
            aria-live="polite"
            aria-busy="true"
            className="page-enter flex flex-col items-center gap-5 rounded-2xl border border-border bg-card p-6 sm:p-10"
        >
            <div className="lens-glow-strong relative aspect-square w-full max-w-sm overflow-hidden rounded-2xl bg-muted sm:aspect-[4/3]">
                {photoPreviewUrl && (
                    // Purely illustrative during a wait state — the status text
                    // below is the actual accessible description of what's happening.
                    <img src={photoPreviewUrl} alt="" className="h-full w-full object-cover" />
                )}
                {/* Autofocus-acquiring rings: a static ring plus an expanding,
                    fading twin — Tailwind's built-in animate-ping, no custom
                    keyframes needed. Collapses under the global reduced-motion
                    guard since animation-duration is forced to 0.01ms there. */}
                <span
                    aria-hidden="true"
                    className="absolute top-1/2 left-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full border-2 border-accent/70"
                />
                <span
                    aria-hidden="true"
                    className="absolute top-1/2 left-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-accent"
                />
                <span aria-hidden="true" className="absolute top-3 left-3 h-7 w-7 border-t-2 border-l-2 border-accent" />
                <span aria-hidden="true" className="absolute top-3 right-3 h-7 w-7 border-t-2 border-r-2 border-accent" />
                <span aria-hidden="true" className="absolute bottom-3 left-3 h-7 w-7 border-b-2 border-l-2 border-accent" />
                <span aria-hidden="true" className="absolute right-3 bottom-3 h-7 w-7 border-r-2 border-b-2 border-accent" />
                <div aria-hidden="true" className="absolute inset-0 bg-linear-to-t from-black/40 via-transparent to-transparent" />
            </div>
            <div className="flex items-center gap-2.5">
                <Aperture
                    size={20}
                    strokeWidth={2}
                    className="animate-[spin_3s_linear_infinite] text-accent"
                    aria-hidden="true"
                />
                <p className="font-display text-base font-semibold text-foreground">
                    <FormattedMessage id="logMeal.analyzing" />
                </p>
            </div>
            <p className="max-w-xs text-center text-sm text-muted-foreground">
                <FormattedMessage id="logMeal.analyzingHint" />
            </p>
        </div>
    );

    const topPrediction = predictions?.[0] ?? null;
    const topMacros = topPrediction?.macros ? scaleToPortion(topPrediction.macros, 100) : null;

    return (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
            <div>
                <h1 className="font-display text-2xl font-bold text-foreground">
                    <FormattedMessage id="logMeal.title" />
                </h1>
                {/* The old subtitle announced "a photo goes to the AI-detection
                    server" on every stage, including manual entry where no photo
                    exists and nothing is sent anywhere. Each stage now says what
                    is actually happening in it. */}
                <p className="mt-1 text-sm text-muted-foreground">
                    <FormattedMessage id={`logMeal.subtitle.${stage}`} />
                </p>
            </div>

            <StageIndicator stage={stage} />

            {stage === 'idle' && (
                <div className="flex flex-col gap-4">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) void handlePhotoSelected(file);
                            event.target.value = '';
                        }}
                    />
                    {/* Separate input carrying capture="environment": on a phone this
                        opens the camera app directly instead of the gallery picker the
                        dropzone's plain file input opens. Native platform feature, no
                        library — harmless no-op on desktop, where it just opens a picker. */}
                    <input
                        ref={cameraInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) void handlePhotoSelected(file);
                            event.target.value = '';
                        }}
                    />

                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        onDragEnter={handleDragOver}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={cn(
                            'group relative flex w-full flex-col items-center gap-4 overflow-hidden rounded-2xl border-2 border-dashed p-10 text-center transition-colors sm:p-16',
                            isDragging
                                ? 'border-accent bg-accent/5 lens-glow-strong'
                                : 'border-border bg-card hover:border-accent/50 hover:bg-secondary/40',
                        )}
                    >
                        {/* Viewfinder corner brackets — decorative framing that reads as
                            a camera instrument rather than a generic file drop rectangle. */}
                        <span aria-hidden="true" className="pointer-events-none absolute top-4 left-4 h-6 w-6 rounded-tl-md border-t-2 border-l-2 border-accent/40" />
                        <span aria-hidden="true" className="pointer-events-none absolute top-4 right-4 h-6 w-6 rounded-tr-md border-t-2 border-r-2 border-accent/40" />
                        <span aria-hidden="true" className="pointer-events-none absolute bottom-4 left-4 h-6 w-6 rounded-bl-md border-b-2 border-l-2 border-accent/40" />
                        <span aria-hidden="true" className="pointer-events-none absolute right-4 bottom-4 h-6 w-6 rounded-br-md border-r-2 border-b-2 border-accent/40" />

                        <span
                            className={cn(
                                'flex h-16 w-16 items-center justify-center rounded-full bg-accent/10 text-accent transition-transform duration-[var(--motion-standard)]',
                                isDragging && 'scale-110',
                            )}
                        >
                            <Aperture size={28} strokeWidth={1.75} />
                        </span>
                        <span className="flex flex-col gap-1">
                            <span className="font-display text-lg font-semibold text-foreground">
                                <FormattedMessage
                                    id={
                                        isDragging
                                            ? 'logMeal.dropzone.dragging'
                                            : 'logMeal.dropzone.idle'
                                    }
                                />
                            </span>
                            <span className="text-sm text-muted-foreground">
                                <FormattedMessage id="logMeal.dropzone.hint" />
                            </span>
                        </span>
                    </button>

                    <div className="flex items-center gap-3 text-xs font-medium text-muted-foreground">
                        <span className="h-px flex-1 bg-border" />
                        <FormattedMessage id="common.or" />
                        <span className="h-px flex-1 bg-border" />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => cameraInputRef.current?.click()}
                            className="gap-2"
                        >
                            <Camera size={16} strokeWidth={2} />
                            <FormattedMessage id="logMeal.useCamera" />
                        </Button>
                        {/* data-testid on the three buttons that drive this form:
                            each is reachable only by its label, and #219
                            translates all of them. The form inputs are not
                            tagged — they already carry react-hook-form's field
                            path as their DOM id ("items.0.portionGrams"), a
                            technical identifier tied to the API payload's own
                            field names, which no translation touches.
                            manual-entry in particular is what
                            accessibility.spec.ts clicks to reach the form state
                            it scans; if that click silently stops working, axe
                            scans the empty capture screen and reports a clean
                            page. */}
                        <Button
                            type="button"
                            variant="outline"
                            onClick={startManualEntry}
                            className="gap-2"
                            data-testid="manual-entry"
                        >
                            <Search size={16} strokeWidth={2} />
                            <FormattedMessage id="logMeal.enterManually" />
                        </Button>
                    </div>
                </div>
            )}

            {stage === 'analyzing' && renderAnalyzingStage()}

            {stage === 'reviewing' && (
                // The workbench: span-8 for the work itself (photo, predictions,
                // items, shop), span-4 for a sticky running total. Unequal on
                // purpose — the items are what takes reading and editing, the
                // total is a number to glance at while doing that, not a peer.
                <form
                    onSubmit={handleSubmit(onSubmit)}
                    className="page-enter grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-6"
                    noValidate
                >
                    <div className="flex flex-col gap-4 lg:col-span-8">
                        {/* The back path out of review: returns to capture without
                            touching whatever the AI already filled in — same
                            handler the bottom-of-form reset used to call, just
                            moved to where a multi-step flow's "back" belongs. */}
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleDiscard}
                            className="-ml-2.5 w-fit gap-2 text-muted-foreground"
                        >
                            <ArrowLeft size={16} strokeWidth={2} />
                            <FormattedMessage
                                id={source === 'ai_photo' ? 'logMeal.retakePhoto' : 'logMeal.startOver'}
                            />
                        </Button>

                    {photoPreviewUrl && (
                        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-2.5">
                            <img
                                src={photoPreviewUrl}
                                alt={intl.formatMessage({ id: 'logMeal.photoAlt' })}
                                className="lens-glow h-14 w-14 shrink-0 rounded-lg object-cover"
                            />
                            <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                                <FormattedMessage id="logMeal.photoAnalyzed" />
                            </p>
                        </div>
                    )}

                    {predictions && topPrediction && (
                        <div
                            className={cn(
                                'rounded-2xl border p-5 sm:p-6',
                                predictionsLowConfidence
                                    ? 'border-destructive/30 bg-destructive/5'
                                    : 'lens-glow border-accent/30 bg-accent/5',
                            )}
                        >
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <Aperture size={16} strokeWidth={2} aria-hidden="true" />
                                    <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                                        <FormattedMessage id="logMeal.aiIdentified" />
                                    </h2>
                                </div>
                                <Badge
                                    variant={predictionsLowConfidence ? 'danger' : 'success'}
                                    className="shrink-0 text-2xs"
                                >
                                    {predictionsLowConfidence ? (
                                        <AlertTriangle size={12} strokeWidth={2.25} aria-hidden="true" />
                                    ) : (
                                        <CheckCircle2 size={12} strokeWidth={2.25} aria-hidden="true" />
                                    )}
                                    <FormattedMessage
                                        id={
                                            predictionsLowConfidence
                                                ? 'logMeal.confidence'
                                                : 'logMeal.confident'
                                        }
                                        values={{ percent: topPrediction.confidence }}
                                    />
                                </Badge>
                            </div>

                            <p className="mt-3 font-display text-xl font-bold text-foreground">
                                {formatLabel(topPrediction.label)}
                            </p>

                            {predictionsLowConfidence ? (
                                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                                    <p className="flex items-center gap-1.5 text-sm text-destructive">
                                        <AlertTriangle size={14} strokeWidth={2} className="shrink-0" aria-hidden="true" />
                                        <FormattedMessage id="logMeal.lowConfidence" />
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => applyPrediction(topPrediction)}
                                        className="text-sm font-semibold text-accent underline underline-offset-2 hover:text-accent/80"
                                    >
                                        <FormattedMessage id="logMeal.useItAnyway" />
                                    </button>
                                </div>
                            ) : (
                                <p className="mt-1 text-sm text-muted-foreground">
                                    <FormattedMessage id="logMeal.filledIn" />
                                </p>
                            )}

                            {topMacros && (
                                <dl className="mt-4 grid grid-cols-4 gap-2">
                                    <NutrientStat
                                        labelId="logMeal.nutrient.cal"
                                        value={topMacros.calories}
                                        colorClass="bg-chart-calorie"
                                    />
                                    <NutrientStat
                                        labelId="macro.protein"
                                        value={topMacros.proteinGrams}
                                        unit="g"
                                        colorClass="bg-chart-protein"
                                    />
                                    <NutrientStat
                                        labelId="macro.carbs"
                                        value={topMacros.carbGrams}
                                        unit="g"
                                        colorClass="bg-chart-carb"
                                    />
                                    <NutrientStat
                                        labelId="macro.fat"
                                        value={topMacros.fatGrams}
                                        unit="g"
                                        colorClass="bg-chart-fat"
                                    />
                                </dl>
                            )}

                            {predictions.length > 1 && (
                                <div className="mt-5">
                                    <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                                        <FormattedMessage id="logMeal.notQuiteRight" />
                                    </p>
                                    <ul className="flex flex-col gap-1.5">
                                        {predictions.slice(1).map((prediction) => (
                                            <li key={prediction.label}>
                                                <button
                                                    type="button"
                                                    onClick={() => applyPrediction(prediction)}
                                                    className="flex w-full items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-left text-sm transition-colors hover:border-accent/50"
                                                >
                                                    <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                                                        {formatLabel(prediction.label)}
                                                    </span>
                                                    <ConfidenceBar confidence={prediction.confidence} />
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}

                    {aiFallbackReason && (
                        <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/60 px-4 py-3">
                            <span className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true">
                                {aiFallbackReason === 'unreachable' ? (
                                    <WifiOff size={18} strokeWidth={2} />
                                ) : (
                                    <ImageOff size={18} strokeWidth={2} />
                                )}
                            </span>
                            <div>
                                <p className="text-sm font-medium text-foreground">
                                    <FormattedMessage
                                        id={
                                            aiFallbackReason === 'unreachable'
                                                ? 'logMeal.fallback.unreachableTitle'
                                                : 'logMeal.fallback.notRecognizedTitle'
                                        }
                                    />
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    <FormattedMessage
                                        id={
                                            aiFallbackReason === 'unreachable'
                                                ? 'logMeal.fallback.unreachableBody'
                                                : 'logMeal.fallback.notRecognizedBody'
                                        }
                                    />
                                </p>
                            </div>
                        </div>
                    )}

                    <Card>
                        <CardContent className="flex flex-col gap-5 pt-6">
                            {fields.map((field, index) => (
                                // A fieldset per item, not a bare div: with three
                                // items the old markup read out as "Food, Portion,
                                // Calories…" three times over with no boundary
                                // between them, and no way to tell which row a
                                // "Remove item" button belonged to.
                                <fieldset
                                    key={field.id}
                                    className="relative flex flex-col gap-3 border-b border-border pb-5 last:border-0 last:pb-0"
                                >
                                    <legend
                                        className={cn(
                                            'text-xs font-semibold tracking-wide text-muted-foreground uppercase',
                                            // A legend is not a flex item, so the
                                            // fieldset's gap does not apply to it —
                                            // without this it sits flush against the
                                            // "Food" label below.
                                            fields.length > 1 && 'mb-1.5',
                                            // One item needs no numbering on screen; a
                                            // screen reader still gets the boundary.
                                            fields.length === 1 && 'sr-only',
                                        )}
                                    >
                                        <FormattedMessage
                                            id="logMeal.item"
                                            values={{ number: index + 1 }}
                                        />
                                    </legend>
                                    {fields.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => remove(index)}
                                            className="absolute -top-2.5 right-0 flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
                                            aria-label={intl.formatMessage(
                                                { id: 'logMeal.removeItem' },
                                                { number: index + 1 },
                                            )}
                                        >
                                            <Trash2 size={16} strokeWidth={2} />
                                        </button>
                                    )}

                                    <div className="flex flex-col gap-1.5">
                                        <Label htmlFor={`items.${index}.foodName`}>
                                            <FormattedMessage id="logMeal.food" />
                                        </Label>
                                        <Controller
                                            control={control}
                                            name={`items.${index}.foodName`}
                                            render={({ field: nameField }) => (
                                                <FoodSearchCombobox
                                                    id={`items.${index}.foodName`}
                                                    value={nameField.value}
                                                    onChange={nameField.onChange}
                                                    onBlur={nameField.onBlur}
                                                    inputRef={nameField.ref}
                                                    placeholder={intl.formatMessage({
                                                        id: 'logMeal.foodPlaceholder',
                                                    })}
                                                    aria-invalid={!!errors.items?.[index]?.foodName}
                                                    aria-describedby={
                                                        errors.items?.[index]?.foodName
                                                            ? `items.${index}.foodName-error`
                                                            : undefined
                                                    }
                                                    onSelect={(result) => handleFoodSelect(index, field.id, result)}
                                                />
                                            )}
                                        />
                                        <FieldError
                                            id={`items.${index}.foodName-error`}
                                            message={errors.items?.[index]?.foodName?.message}
                                        />
                                    </div>

                                    {/* Two tiers, because the five fields are not five
                                        equal decisions. Portion and calories are the
                                        pair that must be right and the only two that
                                        block the submit; protein/carbs/fat arrive
                                        pre-filled from the catalogue and are an
                                        override, not an entry. The old flat
                                        grid-cols-5 gave all five the same weight and,
                                        at the sm breakpoint, wrapped "Carbs" under
                                        "Portion" in a ragged 3+2 block. */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="flex flex-col gap-1.5">
                                            <Label htmlFor={`items.${index}.portionGrams`}>
                                                <FormattedMessage id="logMeal.portion" />
                                            </Label>
                                            <Input
                                                id={`items.${index}.portionGrams`}
                                                type="number"
                                                inputMode="decimal"
                                                min="0"
                                                step="any"
                                                aria-invalid={!!errors.items?.[index]?.portionGrams}
                                                aria-describedby={
                                                    errors.items?.[index]?.portionGrams
                                                        ? `items.${index}.portionGrams-error`
                                                        : undefined
                                                }
                                                {...register(`items.${index}.portionGrams`, {
                                                    onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
                                                        // Recompute from the catalog's per-100g figures on a
                                                        // portion-size edit, but only while this row is still
                                                        // linked to a catalog pick and the user hasn't since
                                                        // hand-edited a macro — at that point their number is
                                                        // deliberate and a portion change shouldn't clobber it.
                                                        const per100g = catalogLinkRef.current[field.id];
                                                        if (!per100g || macrosLockedRef.current[field.id]) return;
                                                        const grams = Number(event.target.value);
                                                        if (!Number.isFinite(grams) || grams <= 0) return;
                                                        const scaled = scaleToPortion(per100g, grams);
                                                        setMacroField(index, 'calories', scaled.calories);
                                                        setMacroField(index, 'proteinGrams', scaled.proteinGrams);
                                                        setMacroField(index, 'carbGrams', scaled.carbGrams);
                                                        setMacroField(index, 'fatGrams', scaled.fatGrams);
                                                    },
                                                })}
                                            />
                                            <FieldError
                                                id={`items.${index}.portionGrams-error`}
                                                message={errors.items?.[index]?.portionGrams?.message}
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                            <Label htmlFor={`items.${index}.calories`} className="flex items-center gap-1.5">
                                                {/* Decorative colour dot echoing the same chart token used
                                                    app-wide for calories — always paired with the text label
                                                    and value, so it's never the sole carrier of meaning. */}
                                                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-chart-calorie" aria-hidden="true" />
                                                <FormattedMessage id="macro.calories" />
                                            </Label>
                                            <Input
                                                id={`items.${index}.calories`}
                                                type="number"
                                                inputMode="decimal"
                                                min="0"
                                                step="any"
                                                aria-invalid={!!errors.items?.[index]?.calories}
                                                aria-describedby={
                                                    errors.items?.[index]?.calories
                                                        ? `items.${index}.calories-error`
                                                        : undefined
                                                }
                                                {...register(`items.${index}.calories`, {
                                                    onChange: () => {
                                                        macrosLockedRef.current[field.id] = true;
                                                    },
                                                })}
                                            />
                                            <FieldError
                                                id={`items.${index}.calories-error`}
                                                message={errors.items?.[index]?.calories?.message}
                                            />
                                        </div>
                                    </div>

                                    <div className="rounded-lg bg-muted/50 p-3">
                                        <p className="mb-2 text-xs text-muted-foreground">
                                            <FormattedMessage id="logMeal.macrosHint" />
                                        </p>
                                        <div className="grid grid-cols-3 gap-3">
                                            <div className="flex flex-col gap-1.5">
                                                <Label htmlFor={`items.${index}.proteinGrams`} className="flex items-center gap-1.5">
                                                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-chart-protein" aria-hidden="true" />
                                                    <FormattedMessage id="macro.proteinGrams" />
                                                </Label>
                                                <Input
                                                    id={`items.${index}.proteinGrams`}
                                                    type="number"
                                                    inputMode="decimal"
                                                    min="0"
                                                    step="any"
                                                    aria-invalid={!!errors.items?.[index]?.proteinGrams}
                                                    aria-describedby={
                                                        errors.items?.[index]?.proteinGrams
                                                            ? `items.${index}.proteinGrams-error`
                                                            : undefined
                                                    }
                                                    {...register(`items.${index}.proteinGrams`, {
                                                        onChange: () => {
                                                            macrosLockedRef.current[field.id] = true;
                                                        },
                                                    })}
                                                />
                                                <FieldError
                                                    id={`items.${index}.proteinGrams-error`}
                                                    message={errors.items?.[index]?.proteinGrams?.message}
                                                />
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                <Label htmlFor={`items.${index}.carbGrams`} className="flex items-center gap-1.5">
                                                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-chart-carb" aria-hidden="true" />
                                                    <FormattedMessage id="macro.carbGrams" />
                                                </Label>
                                                <Input
                                                    id={`items.${index}.carbGrams`}
                                                    type="number"
                                                    inputMode="decimal"
                                                    min="0"
                                                    step="any"
                                                    aria-invalid={!!errors.items?.[index]?.carbGrams}
                                                    aria-describedby={
                                                        errors.items?.[index]?.carbGrams
                                                            ? `items.${index}.carbGrams-error`
                                                            : undefined
                                                    }
                                                    {...register(`items.${index}.carbGrams`, {
                                                        onChange: () => {
                                                            macrosLockedRef.current[field.id] = true;
                                                        },
                                                    })}
                                                />
                                                <FieldError
                                                    id={`items.${index}.carbGrams-error`}
                                                    message={errors.items?.[index]?.carbGrams?.message}
                                                />
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                <Label htmlFor={`items.${index}.fatGrams`} className="flex items-center gap-1.5">
                                                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-chart-fat" aria-hidden="true" />
                                                    <FormattedMessage id="macro.fatGrams" />
                                                </Label>
                                                <Input
                                                    id={`items.${index}.fatGrams`}
                                                    type="number"
                                                    inputMode="decimal"
                                                    min="0"
                                                    step="any"
                                                    aria-invalid={!!errors.items?.[index]?.fatGrams}
                                                    aria-describedby={
                                                        errors.items?.[index]?.fatGrams
                                                            ? `items.${index}.fatGrams-error`
                                                            : undefined
                                                    }
                                                    {...register(`items.${index}.fatGrams`, {
                                                        onChange: () => {
                                                            macrosLockedRef.current[field.id] = true;
                                                        },
                                                    })}
                                                />
                                                <FieldError
                                                    id={`items.${index}.fatGrams-error`}
                                                    message={errors.items?.[index]?.fatGrams?.message}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </fieldset>
                            ))}

                            <Button
                                type="button"
                                variant="ghost"
                                className="w-fit gap-2 text-muted-foreground"
                                onClick={() => {
                                    append(EMPTY_ITEM);
                                }}
                                data-testid="add-item"
                            >
                                <Plus size={16} strokeWidth={2} />
                                <FormattedMessage id="logMeal.addAnotherItem" />
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Below the items and above the buttons on purpose: the shop
                        is one fact about the whole entry, not per item — he bought
                        the Semmel and the Montasio in the same shop — and it must
                        never sit between the user and the submit button. */}
                    <ShopPicker
                        value={shop}
                        onChange={(next) => {
                            setShop(next);
                            setShopFromMemory(false);
                        }}
                        recentChains={shopMemory.recentChains}
                        fromMemory={shopFromMemory}
                    />
                    </div>

                    {/* The sticky summary panel: the number this meal adds to
                        today, plus the page's one primary action, both kept in
                        view while the item list to the left scrolls. The old form
                        ended in five bare inputs and a button, so the one figure
                        the user was actually deciding about was nowhere on
                        screen. */}
                    <div className="lg:col-span-4">
                        <div className="flex flex-col gap-4 lg:sticky lg:top-6">
                            <MealTotals
                                control={control}
                                caloriesSoFar={caloriesSoFar}
                                calorieTarget={dietPlan.data?.dailyCalorieTarget ?? null}
                            />

                            {submitError && (
                                <p
                                    role="alert"
                                    className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive-strong"
                                >
                                    {submitError}
                                    {needsPlan && (
                                        <>
                                            {' '}
                                            <Link
                                                to="/plan"
                                                className="font-medium underline underline-offset-2"
                                            >
                                                <FormattedMessage id="logMeal.setUpPlan" />
                                            </Link>
                                            .
                                        </>
                                    )}
                                </p>
                            )}

                            {/* Confirm is the page's one primary action, kept in
                                the summary panel next to the number it commits —
                                the back path above already covers "I changed my
                                mind", so this no longer needs a sibling discard
                                button competing for the same width. */}
                            <Button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full gap-2"
                                data-testid="confirm-log"
                            >
                                {isSubmitting ? (
                                    <Loader2 size={16} strokeWidth={2.5} className="animate-spin" aria-hidden="true" />
                                ) : (
                                    <Check size={16} strokeWidth={2.5} />
                                )}
                                <FormattedMessage
                                    id={isSubmitting ? 'logMeal.confirming' : 'logMeal.confirm'}
                                />
                            </Button>
                        </div>
                    </div>
                </form>
            )}
        </div>
    );
}

/**
 * One error line, wired to its field by id.
 *
 * Previously only `foodName` rendered a message: every other field set
 * `aria-invalid` and showed nothing, so a negative protein value blocked the
 * submit with no explanation anywhere on the page.
 *
 * role="alert" so a screen reader announces the message as it appears —
 * without it, an error that shows up after a blur (no focus change of its
 * own) is silent to anyone not looking at the screen.
 */
function FieldError({ id, message }: { id: string; message: string | undefined }) {
    if (!message) return null;
    return (
        <p id={id} role="alert" className="text-sm text-destructive">
            {message}
        </p>
    );
}

const STAGE_ORDER: Stage[] = ['idle', 'analyzing', 'reviewing'];
const STAGE_LABELS: Record<Stage, string> = {
    idle: 'logMeal.stage.capture',
    analyzing: 'logMeal.stage.analyze',
    reviewing: 'logMeal.stage.review',
};

/**
 * The segmented 3-stage tracker: capture -> analyze -> review. Always
 * rendered, on every stage, so the current position in the flow is never
 * implicit — the old page had no indication a photo-driven log was a
 * multi-step process at all, only a subtitle that changed wording.
 *
 * A plain ordered list with `aria-current="step"` on the active item, the
 * same pattern a breadcrumb or wizard uses natively — no extra ARIA role
 * needed beyond that.
 */
function StageIndicator({ stage }: { stage: Stage }) {
    const intl = useIntl();
    const activeIndex = STAGE_ORDER.indexOf(stage);
    return (
        <ol
            aria-label={intl.formatMessage({ id: 'logMeal.stage.label' })}
            className="seg-seam flex overflow-hidden rounded-full border border-border"
        >
            {STAGE_ORDER.map((step, index) => {
                const isActive = index === activeIndex;
                const isDone = index < activeIndex;
                return (
                    <li key={step} className="flex-1" aria-current={isActive ? 'step' : undefined}>
                        <div
                            className={cn(
                                'flex items-center justify-center gap-1.5 px-2 py-2 text-2xs font-semibold tracking-wide uppercase transition-colors',
                                isActive
                                    ? 'bg-primary text-primary-foreground'
                                    : isDone
                                      ? 'bg-primary/15 text-primary-strong'
                                      : 'bg-card text-muted-foreground',
                            )}
                        >
                            <span aria-hidden="true" className="font-display tabular-nums">
                                {index + 1}
                            </span>
                            <FormattedMessage id={STAGE_LABELS[step]} />
                        </div>
                    </li>
                );
            })}
        </ol>
    );
}

/**
 * The running total of what is in the form, and what it does to today's target.
 *
 * Subscribes through useWatch rather than the parent re-rendering on every
 * keystroke: only this subtree re-renders while the user types a portion.
 */
function MealTotals({
    control,
    caloriesSoFar,
    calorieTarget,
}: {
    // All three of useForm's type parameters, not just the first: the resolver
    // transforms FormInputs (strings) into FormValues (numbers), and a
    // one-parameter Control describes a form whose resolver returns strings.
    control: Control<FormInputs, unknown, FormValues>;
    caloriesSoFar: number;
    calorieTarget: number | null;
}) {
    const items = useWatch({ control, name: 'items' }) as FormInputs['items'] | undefined;

    const totals = (items ?? []).reduce(
        (acc, item) => ({
            calories: acc.calories + fieldNumber(item.calories),
            protein: acc.protein + fieldNumber(item.proteinGrams),
            carbs: acc.carbs + fieldNumber(item.carbGrams),
            fat: acc.fat + fieldNumber(item.fatGrams),
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 },
    );

    const projected = caloriesSoFar + totals.calories;
    const over = calorieTarget !== null && projected > calorieTarget;
    const pct = calorieTarget !== null && calorieTarget > 0
        ? Math.min(100, Math.round((projected / calorieTarget) * 100))
        : 0;

    return (
        // Cobalt-headed: border-border-key is the key-tile edge token, reserved
        // for the one highest-emphasis tile on a screen — here, the panel that
        // stays on screen and carries the number the whole page is for.
        <div className="overflow-hidden rounded-xl border border-border-key bg-card shadow-elev-2">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 bg-primary/10 px-4 py-3">
                <h2 className="text-xs font-semibold tracking-wide text-primary-strong uppercase">
                    <FormattedMessage id="logMeal.thisMeal" />
                </h2>
                <p className="font-display text-2xl font-bold tabular-nums text-foreground">
                    <FormattedNumber value={Math.round(totals.calories)} />
                    <span className="ml-1 text-sm font-medium text-muted-foreground">kcal</span>
                </p>
            </div>

            <div className="flex flex-col gap-3.5 p-4">
                <dl className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
                    <MacroTotal labelId="macro.protein" grams={totals.protein} colorClass="bg-chart-protein" />
                    <MacroTotal labelId="macro.carbs" grams={totals.carbs} colorClass="bg-chart-carb" />
                    <MacroTotal labelId="macro.fat" grams={totals.fat} colorClass="bg-chart-fat" />
                </dl>

                {calorieTarget !== null && (
                    <div>
                        <p className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 text-xs text-muted-foreground">
                            <span>
                                <FormattedMessage id="logMeal.afterLogging" />
                            </span>
                            <span
                                className={cn(
                                    'font-display tabular-nums',
                                    over ? 'font-semibold text-destructive' : 'text-foreground',
                                )}
                            >
                                <FormattedMessage
                                    id="logMeal.projected"
                                    values={{
                                        projected: Math.round(projected),
                                        target: Math.round(calorieTarget),
                                    }}
                                />
                                {/* The over-target case is stated in words as well as
                                    colour — the red fill alone would carry meaning by
                                    hue only. */}
                                {over && (
                                    <FormattedMessage
                                        id="logMeal.overBy"
                                        values={{ over: Math.round(projected - calorieTarget) }}
                                    />
                                )}
                            </span>
                        </p>
                        {/* House pattern (water-card, macro-bar): muted track, coloured
                            child bound to width, --motion-standard on the width.
                            Over target swaps the solid fill for .over-target's
                            45-degree hatch, so "over" reads in greyscale too, not
                            only through the words above. */}
                        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
                            <div
                                className={cn(
                                    'h-full rounded-full transition-[width] duration-[var(--motion-standard)] ease-out',
                                    over ? 'over-target' : 'bg-chart-calorie',
                                )}
                                style={{ width: `${String(pct)}%` }}
                                aria-hidden="true"
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function MacroTotal({ labelId, grams, colorClass }: { labelId: string; grams: number; colorClass: string }) {
    return (
        <div className="flex items-baseline gap-1.5">
            <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', colorClass)} aria-hidden="true" />
            <dt className="text-muted-foreground">
                <FormattedMessage id={labelId} />
            </dt>
            <dd className="font-mono font-semibold tabular-nums text-foreground">
                <FormattedMessage id="unit.grams" values={{ value: Math.round(grams) }} />
            </dd>
        </div>
    );
}

// Alternative-prediction confidence: a plain neutral bar, not accent/destructive
// coloured — that semantic treatment is reserved for the single top prediction,
// which is the only one backed by the API's own isConfident verdict. These are
// just "how sure was the model", shown for comparison, not a pass/fail signal.
function ConfidenceBar({ confidence }: { confidence: number }) {
    const pct = Math.round(confidence * 100);
    return (
        <span className="flex shrink-0 items-center gap-2">
            <span className="h-1.5 w-14 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                <span className="block h-full rounded-full bg-foreground/50" style={{ width: `${String(Math.max(pct, 4))}%` }} />
            </span>
            <span className="w-9 shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground">
                <FormattedNumber value={confidence} style="percent" />
            </span>
        </span>
    );
}

function NutrientStat({
    labelId,
    value,
    unit,
    colorClass,
}: {
    labelId: string;
    value: number | null;
    unit?: string;
    colorClass: string;
}) {
    return (
        <div className="flex flex-col items-center gap-1 rounded-lg bg-card/70 py-2">
            <span className={cn('h-1.5 w-5 rounded-full', colorClass)} aria-hidden="true" />
            <dt className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                <FormattedMessage id={labelId} />
            </dt>
            <dd className="font-mono text-sm font-semibold tabular-nums text-foreground">
                {value === null ? (
                    '—'
                ) : (
                    <>
                        <FormattedNumber value={value} />
                        {unit ?? ''}
                    </>
                )}
            </dd>
        </div>
    );
}

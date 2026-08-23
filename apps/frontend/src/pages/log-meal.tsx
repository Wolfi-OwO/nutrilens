import { useEffect, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router';
import {
    AlertTriangle,
    Aperture,
    Camera,
    Check,
    CheckCircle2,
    ImageOff,
    Plus,
    RotateCcw,
    Search,
    Trash2,
    WifiOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FoodSearchCombobox, type FoodSearchResult } from '@/components/food-search-combobox';
import { usePhotoPrediction } from '@/hooks/use-photo-prediction';
import { useCreateMealLog } from '@/hooks/use-meal-logs';
import { ApiError } from '@/lib/api-client';
import { scaleToPortion } from '@/lib/portion-macros';
import { cn } from '@/lib/utils';
import type { MealLogSource, PerHundredGramMacros, PhotoPrediction } from '@/types/api';

// Zod schema: form fields are coerced from strings (HTML inputs) to numbers.
// Number inputs with empty values send empty strings to the form, which zod's
// pipe and coerce converts and validates.
const itemSchema = z.object({
    foodName: z.string().min(1, 'Required'),
    portionGrams: z.string().pipe(z.coerce.number()).pipe(z.number().positive('Must be greater than 0')),
    calories: z.string().pipe(z.coerce.number()).pipe(z.number().nonnegative('Must be 0 or more')),
    proteinGrams: z.string().pipe(z.coerce.number()).pipe(z.number().nonnegative()).optional(),
    carbGrams: z.string().pipe(z.coerce.number()).pipe(z.number().nonnegative()).optional(),
    fatGrams: z.string().pipe(z.coerce.number()).pipe(z.number().nonnegative()).optional(),
});

const formSchema = z.object({ items: z.array(itemSchema).min(1) });
type FormValues = z.infer<typeof formSchema>;

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

    const photoPrediction = usePhotoPrediction();
    const createMealLog = useCreateMealLog();

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
        resolver: zodResolver(formSchema),
        defaultValues: { items: [EMPTY_ITEM] },
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
            setSubmitError('Please select a valid image file.');
            return;
        }

        const objectUrl = URL.createObjectURL(file);
        if (!objectUrl.startsWith('blob:')) {
            setSubmitError('Unable to preview this file safely.');
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
            void navigate('/');
        } catch (error) {
            if (error instanceof ApiError && error.status === 409) {
                setSubmitError('You need an active diet plan before logging a meal.');
                setNeedsPlan(true);
            } else {
                setSubmitError('Something went wrong saving this meal. Please try again.');
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
                <p className="font-display text-base font-semibold text-foreground">Analyzing your photo…</p>
            </div>
            <p className="max-w-xs text-center text-sm text-muted-foreground">
                Matching it against the food-recognition model — this takes a few seconds.
            </p>
        </div>
    );

    const topPrediction = predictions?.[0] ?? null;
    const topMacros = topPrediction?.macros ? scaleToPortion(topPrediction.macros, 100) : null;

    return (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
            <div>
                <h1 className="font-display text-2xl font-bold text-foreground">Log a meal</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    A photo goes to the AI-detection server for analysis.
                </p>
            </div>

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
                                {isDragging ? 'Drop it here' : 'Take or upload a photo'}
                            </span>
                            <span className="text-sm text-muted-foreground">
                                Drag a photo in, or tap to choose one
                            </span>
                        </span>
                    </button>

                    <div className="flex items-center gap-3 text-xs font-medium text-muted-foreground">
                        <span className="h-px flex-1 bg-border" />
                        or
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
                            Use camera
                        </Button>
                        <Button type="button" variant="outline" onClick={startManualEntry} className="gap-2">
                            <Search size={16} strokeWidth={2} />
                            Enter it manually
                        </Button>
                    </div>
                </div>
            )}

            {stage === 'analyzing' && renderAnalyzingStage()}

            {stage === 'reviewing' && (
                <form onSubmit={handleSubmit(onSubmit)} className="page-enter flex flex-col gap-4" noValidate>
                    {photoPreviewUrl && (
                        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-2.5">
                            <img
                                src={photoPreviewUrl}
                                alt="Selected meal photo"
                                className="lens-glow h-14 w-14 shrink-0 rounded-lg object-cover"
                            />
                            <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                                Photo analyzed — correct anything below if it's not quite right.
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
                                        AI identified
                                    </h2>
                                </div>
                                <span
                                    className={cn(
                                        'inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold',
                                        predictionsLowConfidence
                                            ? 'bg-destructive/10 text-destructive'
                                            : 'bg-accent/10 text-accent',
                                    )}
                                >
                                    {predictionsLowConfidence ? (
                                        <AlertTriangle size={12} strokeWidth={2.25} aria-hidden="true" />
                                    ) : (
                                        <CheckCircle2 size={12} strokeWidth={2.25} aria-hidden="true" />
                                    )}
                                    {Math.round(topPrediction.confidence * 100)}%
                                    {predictionsLowConfidence ? ' confidence' : ' confident'}
                                </span>
                            </div>

                            <p className="mt-3 font-display text-xl font-bold text-foreground">
                                {formatLabel(topPrediction.label)}
                            </p>

                            {predictionsLowConfidence ? (
                                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                                    <p className="flex items-center gap-1.5 text-sm text-destructive">
                                        <AlertTriangle size={14} strokeWidth={2} className="shrink-0" aria-hidden="true" />
                                        Not confident about this one — double check before confirming.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => applyPrediction(topPrediction)}
                                        className="text-sm font-semibold text-accent underline underline-offset-2 hover:text-accent/80"
                                    >
                                        Use it anyway
                                    </button>
                                </div>
                            ) : (
                                <p className="mt-1 text-sm text-muted-foreground">Filled in below — check it over.</p>
                            )}

                            {topMacros && (
                                <dl className="mt-4 grid grid-cols-4 gap-2">
                                    <NutrientStat label="Cal" value={topMacros.calories} colorClass="bg-chart-calorie" />
                                    <NutrientStat
                                        label="Protein"
                                        value={topMacros.proteinGrams}
                                        unit="g"
                                        colorClass="bg-chart-protein"
                                    />
                                    <NutrientStat label="Carbs" value={topMacros.carbGrams} unit="g" colorClass="bg-chart-carb" />
                                    <NutrientStat label="Fat" value={topMacros.fatGrams} unit="g" colorClass="bg-chart-fat" />
                                </dl>
                            )}

                            {predictions.length > 1 && (
                                <div className="mt-5">
                                    <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                                        Not quite right?
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
                                    {aiFallbackReason === 'unreachable'
                                        ? "Couldn't reach the AI service"
                                        : "Couldn't identify this photo"}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    {aiFallbackReason === 'unreachable'
                                        ? 'Enter what you ate below — nothing was lost.'
                                        : "We couldn't match it to a known food — enter what you ate below."}
                                </p>
                            </div>
                        </div>
                    )}

                    <Card>
                        <CardContent className="flex flex-col gap-5 pt-6">
                            {fields.map((field, index) => (
                                <div
                                    key={field.id}
                                    className="flex flex-col gap-3 border-b border-border pb-5 last:border-0 last:pb-0"
                                >
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor={`items.${index}.foodName`}>Food</Label>
                                        {fields.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => remove(index)}
                                                className="-m-2.5 flex h-11 w-11 items-center justify-center text-muted-foreground transition-colors hover:text-destructive"
                                                aria-label="Remove item"
                                            >
                                                <Trash2 size={16} strokeWidth={2} />
                                            </button>
                                        )}
                                    </div>
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
                                                placeholder="Grilled chicken salad"
                                                aria-invalid={!!errors.items?.[index]?.foodName}
                                                onSelect={(result) => handleFoodSelect(index, field.id, result)}
                                            />
                                        )}
                                    />
                                    {errors.items?.[index]?.foodName && (
                                        <p className="text-sm text-destructive">
                                            {errors.items[index]?.foodName?.message}
                                        </p>
                                    )}

                                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                                        <div className="flex flex-col gap-1.5">
                                            <Label htmlFor={`items.${index}.portionGrams`}>
                                                Portion (g)
                                            </Label>
                                            <Input
                                                id={`items.${index}.portionGrams`}
                                                type="number"
                                                inputMode="decimal"
                                                aria-invalid={!!errors.items?.[index]?.portionGrams}
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
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                            <Label htmlFor={`items.${index}.calories`} className="flex items-center gap-1.5">
                                                {/* Decorative colour dot echoing the same chart token used
                                                    app-wide for calories — always paired with the text label
                                                    and value, so it's never the sole carrier of meaning. */}
                                                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-chart-calorie" aria-hidden="true" />
                                                Calories
                                            </Label>
                                            <Input
                                                id={`items.${index}.calories`}
                                                type="number"
                                                inputMode="decimal"
                                                aria-invalid={!!errors.items?.[index]?.calories}
                                                {...register(`items.${index}.calories`, {
                                                    onChange: () => {
                                                        macrosLockedRef.current[field.id] = true;
                                                    },
                                                })}
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                            <Label htmlFor={`items.${index}.proteinGrams`} className="flex items-center gap-1.5">
                                                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-chart-protein" aria-hidden="true" />
                                                Protein (g)
                                            </Label>
                                            <Input
                                                id={`items.${index}.proteinGrams`}
                                                type="number"
                                                inputMode="decimal"
                                                {...register(`items.${index}.proteinGrams`, {
                                                    onChange: () => {
                                                        macrosLockedRef.current[field.id] = true;
                                                    },
                                                })}
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                            <Label htmlFor={`items.${index}.carbGrams`} className="flex items-center gap-1.5">
                                                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-chart-carb" aria-hidden="true" />
                                                Carbs (g)
                                            </Label>
                                            <Input
                                                id={`items.${index}.carbGrams`}
                                                type="number"
                                                inputMode="decimal"
                                                {...register(`items.${index}.carbGrams`, {
                                                    onChange: () => {
                                                        macrosLockedRef.current[field.id] = true;
                                                    },
                                                })}
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                            <Label htmlFor={`items.${index}.fatGrams`} className="flex items-center gap-1.5">
                                                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-chart-fat" aria-hidden="true" />
                                                Fat (g)
                                            </Label>
                                            <Input
                                                id={`items.${index}.fatGrams`}
                                                type="number"
                                                inputMode="decimal"
                                                {...register(`items.${index}.fatGrams`, {
                                                    onChange: () => {
                                                        macrosLockedRef.current[field.id] = true;
                                                    },
                                                })}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}

                            <Button
                                type="button"
                                variant="ghost"
                                className="w-fit gap-2 text-muted-foreground"
                                onClick={() => {
                                    append(EMPTY_ITEM);
                                }}
                            >
                                <Plus size={16} strokeWidth={2} />
                                Add another item
                            </Button>
                        </CardContent>
                    </Card>

                    {submitError && (
                        <p
                            role="alert"
                            className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
                        >
                            {submitError}
                            {needsPlan && (
                                <>
                                    {' '}
                                    <Link
                                        to="/plan"
                                        className="font-medium underline underline-offset-2"
                                    >
                                        Set up a plan
                                    </Link>
                                    .
                                </>
                            )}
                        </p>
                    )}

                    <div className="flex gap-3">
                        <Button type="submit" disabled={isSubmitting} className="flex-1 gap-2">
                            <Check size={16} strokeWidth={2.5} />
                            {isSubmitting ? 'Logging…' : 'Confirm & log'}
                        </Button>
                        <Button type="button" variant="outline" className="flex-1 gap-2" onClick={handleDiscard}>
                            <RotateCcw size={16} strokeWidth={2} />
                            {source === 'ai_photo' ? 'Retake photo' : 'Start over'}
                        </Button>
                    </div>
                </form>
            )}
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
                {pct}%
            </span>
        </span>
    );
}

function NutrientStat({
    label,
    value,
    unit,
    colorClass,
}: {
    label: string;
    value: number | null;
    unit?: string;
    colorClass: string;
}) {
    return (
        <div className="flex flex-col items-center gap-1 rounded-lg bg-card/70 py-2">
            <span className={cn('h-1.5 w-5 rounded-full', colorClass)} aria-hidden="true" />
            <dt className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">{label}</dt>
            <dd className="font-mono text-sm font-semibold tabular-nums text-foreground">
                {value === null ? '—' : `${String(value)}${unit ?? ''}`}
            </dd>
        </div>
    );
}

import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useIntl } from 'react-intl';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

// One toggle, reused by login/register's #password field and profile's
// delete-account password field — three call sites wanting the identical
// show/hide affordance is what earns this its own file rather than three
// copies of the same eye-icon button.
//
// forwardRef so react-hook-form's `register('password').ref` still lands on
// the real <input> (not this wrapper) — RHF calls .focus()/.value on that ref
// directly, so anything else silently breaks its own error-focus behaviour.
export const PasswordInput = React.forwardRef<
    HTMLInputElement,
    Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>
>(({ className, ...props }, ref) => {
    const intl = useIntl();
    const [visible, setVisible] = React.useState(false);

    return (
        <div className="relative">
            <Input
                ref={ref}
                type={visible ? 'text' : 'password'}
                className={cn('pr-11', className)}
                {...props}
            />
            <button
                type="button"
                onClick={() => setVisible((v) => !v)}
                // A state-describing label ("Show password"/"Hide password"),
                // not an icon-only control with no name at all — the icon
                // swap alone says nothing to a screen reader.
                aria-label={intl.formatMessage({
                    id: visible ? 'auth.password.hide' : 'auth.password.show',
                })}
                className="absolute top-1/2 right-1 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
                {visible ? (
                    <EyeOff size={16} strokeWidth={2} aria-hidden="true" />
                ) : (
                    <Eye size={16} strokeWidth={2} aria-hidden="true" />
                )}
            </button>
        </div>
    );
});
PasswordInput.displayName = 'PasswordInput';

"use client";
// Animated select dropdown (Radix menu + motion), ported from a Tailwind component
// to the site's plain CSS (.dd-* classes in globals.css, colors from :root tokens).
// Only the select-style parts are kept: Dropdown, DropdownTrigger, DropdownValue,
// DropdownContent, DropdownItem.

import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import { Check, ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import * as React from "react";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

const MAX_HEIGHT = 320;
const VIEWPORT_PADDING = 12;
const FLUID_EASE = [0.16, 1, 0.3, 1] as const;
const EXIT_EASE = [0.4, 0, 0.6, 1] as const;
const SPRING = { type: "spring" as const, stiffness: 260, damping: 32, mass: 0.95 };
const HIGHLIGHT_SPRING = { type: "spring" as const, stiffness: 600, damping: 38 };
const CHECK_SPRING = { type: "spring" as const, stiffness: 460, damping: 24, mass: 0.5 };

type FocusTarget = "first" | "last" | "selected";

type Ctx = {
  activeItemId: string | undefined;
  contentId: string;
  disabled: boolean;
  focusTargetRef: React.MutableRefObject<FocusTarget>;
  labels: Record<string, string>;
  open: boolean;
  rootRef: React.RefObject<HTMLDivElement | null>;
  setActiveItemId: React.Dispatch<React.SetStateAction<string | undefined>>;
  setOpen: (open: boolean) => void;
  setValue: (value: string) => void;
  skipCloseAnimationRef: React.MutableRefObject<boolean>;
  value: string | undefined;
};

const DropdownContext = React.createContext<Ctx | null>(null);

function useDropdown(name: string) {
  const ctx = React.useContext(DropdownContext);
  if (!ctx) throw new Error(`${name} must be used within Dropdown.`);
  return ctx;
}

function getText(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(getText).join("");
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) return getText(node.props.children);
  return "";
}

function collectLabels(node: React.ReactNode): Record<string, string> {
  const labels: Record<string, string> = {};
  const visit = (child: React.ReactNode) => {
    if (!React.isValidElement(child)) {
      if (Array.isArray(child)) child.forEach(visit);
      return;
    }
    const el = child as React.ReactElement<{ children?: React.ReactNode; textValue?: string; value?: string }>;
    const name = typeof el.type === "string" ? el.type : (el.type as { displayName?: string }).displayName;
    if (name === "DropdownItem" && el.props.value !== undefined) {
      labels[el.props.value] = (el.props.textValue ?? getText(el.props.children)).trim();
    }
    React.Children.forEach(el.props.children, visit);
  };
  React.Children.forEach(node, visit);
  return labels;
}

function focusMenuItem(root: HTMLElement | null, target: FocusTarget, value?: string) {
  const items = root ? Array.from(root.querySelectorAll<HTMLElement>("[data-dropdown-item]:not([data-disabled])")) : [];
  if (!items.length) return;
  let index = 0;
  if (target === "last") index = items.length - 1;
  else if (target === "selected" && value !== undefined) {
    const i = items.findIndex((item) => item.dataset.value === value);
    index = i >= 0 ? i : 0;
  }
  items[index]?.focus();
}

export interface DropdownProps {
  /** Full width of the parent (form fields). */
  block?: boolean;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  /** Also submit the value with a plain <form> under this name. */
  name?: string;
  onValueChange: (value: string) => void;
  value: string | undefined;
}

export function Dropdown({ block, children, className, disabled = false, name, onValueChange, value }: DropdownProps) {
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const contentId = React.useId();
  const focusTargetRef = React.useRef<FocusTarget>("selected");
  const skipCloseAnimationRef = React.useRef(false);
  const [open, setOpen] = React.useState(false);
  const [activeItemId, setActiveItemId] = React.useState<string | undefined>();
  const labels = React.useMemo(() => collectLabels(children), [children]);

  const ctx = React.useMemo<Ctx>(
    () => ({
      activeItemId, contentId, disabled, focusTargetRef, labels, open, rootRef, setActiveItemId,
      setOpen, setValue: onValueChange, skipCloseAnimationRef, value,
    }),
    [activeItemId, contentId, disabled, labels, open, onValueChange, value],
  );

  return (
    <DropdownContext.Provider value={ctx}>
      <DropdownMenuPrimitive.Root
        modal={false}
        open={open}
        onOpenChange={(next) => {
          if (next) skipCloseAnimationRef.current = false;
          else setActiveItemId(undefined);
          setOpen(next);
        }}
      >
        <div ref={rootRef} className={cx("dd", block && "dd-block", className)}>
          {name ? <input type="hidden" name={name} value={value ?? ""} /> : null}
          {children}
        </div>
      </DropdownMenuPrimitive.Root>
    </DropdownContext.Provider>
  );
}

export interface DropdownTriggerProps
  extends Omit<React.ComponentPropsWithoutRef<typeof motion.button>, "children"> {
  children?: React.ReactNode;
}

export const DropdownTrigger = React.forwardRef<HTMLButtonElement, DropdownTriggerProps>(
  ({ children, className, onKeyDown, onPointerDown, ...props }, ref) => {
    const { contentId, disabled, focusTargetRef, open, setOpen } = useDropdown("DropdownTrigger");
    return (
      <DropdownMenuPrimitive.Trigger asChild disabled={disabled}>
        <motion.button
          ref={ref}
          type="button"
          className={cx("dd-trigger", className)}
          aria-controls={contentId}
          aria-expanded={open}
          aria-haspopup="listbox"
          data-state={open ? "open" : "closed"}
          disabled={disabled}
          whileTap={disabled ? undefined : { scale: 0.97 }}
          onKeyDown={(e) => {
            onKeyDown?.(e);
            if (e.defaultPrevented || disabled) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              focusTargetRef.current = "first";
              setOpen(true);
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              focusTargetRef.current = "last";
              setOpen(true);
            }
            if (e.key === "Enter" || e.key === " ") focusTargetRef.current = "selected";
          }}
          onPointerDown={(e) => {
            onPointerDown?.(e);
            if (!(e.defaultPrevented || disabled)) focusTargetRef.current = "selected";
          }}
          {...props}
        >
          <span className="dd-trigger-label">{children}</span>
          <motion.span className="dd-chevron" animate={{ rotate: open ? 180 : 0 }} transition={SPRING}>
            <ChevronDown size={16} aria-hidden />
          </motion.span>
        </motion.button>
      </DropdownMenuPrimitive.Trigger>
    );
  },
);
DropdownTrigger.displayName = "DropdownTrigger";

export function DropdownValue({ placeholder = "Выберите" }: { placeholder?: string }) {
  const { labels, value } = useDropdown("DropdownValue");
  const label = value !== undefined ? labels[value] : undefined;
  return <span className={cx("dd-value", !label && "dd-placeholder")}>{label || placeholder}</span>;
}

export interface DropdownContentProps {
  align?: "start" | "center" | "end";
  children?: React.ReactNode;
  className?: string;
  /** Panel as wide as the trigger. */
  matchTriggerWidth?: boolean;
}

export function DropdownContent({ align = "start", children, className, matchTriggerWidth = false }: DropdownContentProps) {
  const { contentId, focusTargetRef, open, rootRef, setActiveItemId, setOpen, skipCloseAnimationRef, value } = useDropdown("DropdownContent");
  // A modal <dialog> sits in the browser's top layer: render the panel inside it, or it ends up underneath.
  const dialog = open ? (rootRef.current?.closest("dialog") ?? undefined) : undefined;
  const listRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => focusMenuItem(listRef.current, focusTargetRef.current, value));
    return () => cancelAnimationFrame(frame);
  }, [focusTargetRef, open, value]);

  const variants = {
    open: {
      opacity: 1, scale: 1, y: 0,
      transition: { opacity: { duration: 0.34, ease: FLUID_EASE }, scale: SPRING, y: SPRING },
    },
    closed: { opacity: 0, scale: 0.985, y: -5, transition: { duration: 0.22, ease: EXIT_EASE } },
    closedInstant: { opacity: 0, scale: 0.985, y: -5, transition: { duration: 0 } },
  };

  return (
    <AnimatePresence onExitComplete={() => (skipCloseAnimationRef.current = false)}>
      {open ? (
        <DropdownMenuPrimitive.Portal forceMount container={dialog}>
          <DropdownMenuPrimitive.Content
            forceMount
            loop
            align={align}
            side="bottom"
            sideOffset={6}
            collisionPadding={VIEWPORT_PADDING}
            className="dd-content"
            onCloseAutoFocus={() => (focusTargetRef.current = "selected")}
            onEscapeKeyDown={(e) => {
              // Inside a dialog, Esc closes only the list, not the whole dialog.
              if (dialog) {
                e.preventDefault();
                setOpen(false);
              }
            }}
            style={{ width: matchTriggerWidth ? "var(--radix-dropdown-menu-trigger-width)" : undefined }}
          >
            <motion.div
              id={contentId}
              role="listbox"
              className={cx("dd-panel", className)}
              style={{ transformOrigin: align === "end" ? "top right" : align === "center" ? "top center" : "top left" }}
              variants={variants}
              initial="closed"
              animate="open"
              exit={skipCloseAnimationRef.current ? "closedInstant" : "closed"}
            >
              <ScrollAreaPrimitive.Root
                className="dd-scroll"
                type="hover"
                scrollHideDelay={100}
                style={{ maxHeight: `min(${MAX_HEIGHT}px, var(--radix-dropdown-menu-content-available-height, ${MAX_HEIGHT}px))` }}
              >
                <ScrollAreaPrimitive.Viewport className="dd-viewport" style={{ maxHeight: "inherit" }}>
                  <div
                    ref={listRef}
                    className="dd-list"
                    onPointerLeave={(e) => {
                      if (!listRef.current?.contains(e.relatedTarget as Node | null)) setActiveItemId(undefined);
                    }}
                  >
                    {children}
                  </div>
                </ScrollAreaPrimitive.Viewport>
                <ScrollAreaPrimitive.Scrollbar className="dd-scrollbar" orientation="vertical">
                  <ScrollAreaPrimitive.Thumb className="dd-thumb" />
                </ScrollAreaPrimitive.Scrollbar>
              </ScrollAreaPrimitive.Root>
            </motion.div>
          </DropdownMenuPrimitive.Content>
        </DropdownMenuPrimitive.Portal>
      ) : null}
    </AnimatePresence>
  );
}

export interface DropdownItemProps {
  children: React.ReactNode;
  disabled?: boolean;
  /** Shifted right, for a sub-item (e.g. a subdivision under its department). */
  indent?: boolean;
  textValue?: string;
  value: string;
}

export function DropdownItem({ children, disabled, indent, textValue, value }: DropdownItemProps) {
  const { activeItemId, contentId, setActiveItemId, setValue, skipCloseAnimationRef, value: selected } = useDropdown("DropdownItem");
  const itemId = React.useId();
  const label = (textValue ?? getText(children)).trim();
  const isSelected = selected === value;
  const activate = () => {
    if (!disabled) setActiveItemId(itemId);
  };
  return (
    <DropdownMenuPrimitive.Item
      asChild
      disabled={disabled}
      textValue={label}
      onSelect={(e) => {
        if (disabled || e.defaultPrevented) return;
        skipCloseAnimationRef.current = true;
        setValue(value);
      }}
    >
      <div
        className={cx("dd-item", indent && "dd-item-indent")}
        role="option"
        aria-selected={isSelected}
        aria-disabled={disabled || undefined}
        data-disabled={disabled ? "" : undefined}
        data-dropdown-item=""
        data-value={value}
        onFocus={activate}
        onMouseEnter={activate}
        onPointerMove={activate}
      >
        {activeItemId === itemId && (
          <motion.span className="dd-highlight" layoutId={`${contentId}-active`} transition={HIGHLIGHT_SPRING} />
        )}
        <span className="dd-item-label">{children}</span>
        {isSelected && (
          <motion.span className="dd-check" initial={{ opacity: 0, scale: 0.96, y: 1 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={CHECK_SPRING}>
            <Check size={16} aria-hidden />
          </motion.span>
        )}
      </div>
    </DropdownMenuPrimitive.Item>
  );
}
DropdownItem.displayName = "DropdownItem";

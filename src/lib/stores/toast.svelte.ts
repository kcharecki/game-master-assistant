/**
 * App-wide toast/undo store. One shared instance mounted once via Toast.svelte
 * in App.svelte. Destructive actions call `toast.undoable(msg, undoFn)`; the
 * user can undo before the toast auto-dismisses. Plain notices use `toast.show`.
 */

export interface ToastState {
  id: number;
  message: string;
  /** present only for undoable toasts */
  undoFn?: () => void;
}

/** Default auto-dismiss window for a toast, in ms. */
export const TOAST_MS = 6000;

class ToastStore {
  current = $state<ToastState | null>(null);
  #seq = 0;
  #timer: ReturnType<typeof setTimeout> | null = null;

  /** Show a plain, auto-dismissing notice. */
  show(message: string, ms = TOAST_MS): void {
    this.#set({ id: ++this.#seq, message }, ms);
  }

  /**
   * Show a destructive-action toast with an Undo button. `undoFn` runs if the
   * user clicks Undo before the toast dismisses. Replaces any current toast.
   */
  undoable(message: string, undoFn: () => void, ms = TOAST_MS): void {
    this.#set({ id: ++this.#seq, message, undoFn }, ms);
  }

  /** Run the current toast's undo (if any) and dismiss it. */
  undo(): void {
    this.current?.undoFn?.();
    this.dismiss();
  }

  dismiss(): void {
    if (this.#timer) {
      clearTimeout(this.#timer);
      this.#timer = null;
    }
    this.current = null;
  }

  #set(state: ToastState, ms: number): void {
    if (this.#timer) clearTimeout(this.#timer);
    this.current = state;
    // guard for non-browser (test) environments without a real timer loop
    if (typeof setTimeout !== 'undefined') {
      this.#timer = setTimeout(() => {
        // only clear if it's still the same toast
        if (this.current?.id === state.id) this.current = null;
        this.#timer = null;
      }, ms);
    }
  }
}

export const toast = new ToastStore();

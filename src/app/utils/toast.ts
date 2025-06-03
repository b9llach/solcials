// Toast notification utility to replace alert() calls
export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastOptions {
  duration?: number; // in milliseconds
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

export class Toast {
  private static toastContainer: HTMLElement | null = null;
  private static toastId = 0;

  private static createContainer() {
    if (this.toastContainer) return;
    
    this.toastContainer = document.createElement('div');
    this.toastContainer.id = 'toast-container';
    this.toastContainer.className = 'fixed top-4 right-4 z-[9999] space-y-2 pointer-events-none max-w-md';
    document.body.appendChild(this.toastContainer);
  }

  private static createToast(message: string, type: ToastType, options: ToastOptions = {}) {
    this.createContainer();
    if (!this.toastContainer) return;

    const { duration = 4000 } = options;
    const toastId = ++this.toastId;

    const toast = document.createElement('div');
    toast.id = `toast-${toastId}`;
    toast.className = `
      transform transition-all duration-300 ease-in-out
      pointer-events-auto
      w-full max-w-md min-w-[350px]
      bg-white dark:bg-gray-800
      shadow-lg rounded-lg
      border border-gray-200 dark:border-gray-700
      overflow-hidden
      translate-x-full opacity-0
      ${this.getTypeClasses(type)}
    `.trim().replace(/\s+/g, ' ');

    const icon = this.getIcon(type);
    const colors = this.getColors(type);

    toast.innerHTML = `
      <div class="p-4">
        <div class="flex items-start">
          <div class="flex-shrink-0">
            <div class="${colors.iconBg} rounded-full p-1">
              ${icon}
            </div>
          </div>
          <div class="ml-3 w-0 flex-1">
            <p class="text-sm font-medium ${colors.text}">
              ${this.escapeHtml(message)}
            </p>
          </div>
          <div class="ml-4 flex-shrink-0 flex">
            <button class="rounded-md inline-flex text-gray-400 hover:text-gray-500 focus:outline-none" onclick="this.parentElement.parentElement.parentElement.parentElement.remove()">
              <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    `;

    this.toastContainer.appendChild(toast);

    // Animate in
    setTimeout(() => {
      toast.classList.remove('translate-x-full', 'opacity-0');
      toast.classList.add('translate-x-0', 'opacity-100');
    }, 100);

    // Auto remove
    setTimeout(() => {
      this.removeToast(toast);
    }, duration);

    return toast;
  }

  private static removeToast(toast: HTMLElement) {
    toast.classList.remove('translate-x-0', 'opacity-100');
    toast.classList.add('translate-x-full', 'opacity-0');
    
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }

  private static getTypeClasses(type: ToastType): string {
    switch (type) {
      case 'success':
        return 'border-l-4 border-green-400';
      case 'error':
        return 'border-l-4 border-red-400';
      case 'warning':
        return 'border-l-4 border-yellow-400';
      case 'info':
        return 'border-l-4 border-blue-400';
      default:
        return 'border-l-4 border-gray-400';
    }
  }

  private static getColors(type: ToastType) {
    switch (type) {
      case 'success':
        return {
          iconBg: 'bg-green-100 dark:bg-green-900',
          text: 'text-green-800 dark:text-green-200'
        };
      case 'error':
        return {
          iconBg: 'bg-red-100 dark:bg-red-900',
          text: 'text-red-800 dark:text-red-200'
        };
      case 'warning':
        return {
          iconBg: 'bg-yellow-100 dark:bg-yellow-900',
          text: 'text-yellow-800 dark:text-yellow-200'
        };
      case 'info':
        return {
          iconBg: 'bg-blue-100 dark:bg-blue-900',
          text: 'text-blue-800 dark:text-blue-200'
        };
      default:
        return {
          iconBg: 'bg-gray-100 dark:bg-gray-900',
          text: 'text-gray-800 dark:text-gray-200'
        };
    }
  }

  private static getIcon(type: ToastType): string {
    switch (type) {
      case 'success':
        return '<svg class="w-4 h-4 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path></svg>';
      case 'error':
        return '<svg class="w-4 h-4 text-red-600 dark:text-red-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg>';
      case 'warning':
        return '<svg class="w-4 h-4 text-yellow-600 dark:text-yellow-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg>';
      case 'info':
        return '<svg class="w-4 h-4 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path></svg>';
      default:
        return '<svg class="w-4 h-4 text-gray-600 dark:text-gray-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path></svg>';
    }
  }

  private static escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Public methods
  static success(message: string, options?: ToastOptions) {
    return this.createToast(message, 'success', options);
  }

  static error(message: string, options?: ToastOptions) {
    return this.createToast(message, 'error', options);
  }

  static warning(message: string, options?: ToastOptions) {
    return this.createToast(message, 'warning', options);
  }

  static info(message: string, options?: ToastOptions) {
    return this.createToast(message, 'info', options);
  }

  static show(message: string, type: ToastType = 'info', options?: ToastOptions) {
    return this.createToast(message, type, options);
  }
} 
/**
 * Global Type Definitions
 */

export interface NavItem {
  label: string;
  href: string;
  icon?: string;
}

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}

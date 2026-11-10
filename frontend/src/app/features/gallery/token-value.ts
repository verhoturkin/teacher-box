import { DOCUMENT } from '@angular/common';
import { Pipe, PipeTransform, inject } from '@angular/core';

/**
 * The computed value of a custom property on `<html>` (`'--tb-shape-lg' | tbTokenValue` → `16px`), so a sample
 * shows the value of `styles.scss` instead of a copy of it; empty where the styles are not loaded.
 */
@Pipe({ name: 'tbTokenValue' })
export class TokenValue implements PipeTransform {
  private readonly root = inject(DOCUMENT).documentElement;

  transform(token: string): string {
    return getComputedStyle(this.root).getPropertyValue(token).trim();
  }
}

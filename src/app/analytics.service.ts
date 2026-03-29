import { Injectable, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { Analytics, getAnalytics, isSupported, logEvent } from 'firebase/analytics';
import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import { firebaseConfig } from './firebase.config';

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly router = inject(Router);

  private analytics: Analytics | null = null;
  private initialized = false;
  private lastTrackedPath = '';

  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    const supported = await isSupported();
    if (!supported) return;

    const app = this.getOrCreateApp();
    this.analytics = getAnalytics(app);

    this.trackPageView(window.location.pathname + window.location.search + window.location.hash);

    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.trackPageView(event.urlAfterRedirects);
      });
  }

  private getOrCreateApp(): FirebaseApp {
    return getApps().length ? getApp() : initializeApp(firebaseConfig);
  }

  private trackPageView(path: string): void {
    if (!this.analytics || this.lastTrackedPath === path) return;

    this.lastTrackedPath = path;

    logEvent(this.analytics, 'page_view', {
      page_path: path,
      page_location: window.location.href,
      page_title: document.title,
    });
  }
}

import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Subscription, interval, of } from 'rxjs';
import { catchError, startWith, switchMap, tap } from 'rxjs/operators';
import { HttpClientJsonpModule } from '@angular/common/http';

type Side = 'LEFT' | 'RIGHT';

interface SheetImage {
  url: string;
  name: string;
  order: number;
}

interface SheetCategory {
  side: Side;
  name: string;
  order: number;
  extras?: string; // "a|b|c"
}

interface SheetItem {
  side: Side;
  category: string;
  name: string;
  price: string;
  disclaimer?: string;
  top?: boolean;
  order: number;
  active: boolean;
}

interface MenuConfigResponse {
  updatedAt: string;
  images: SheetImage[];
  categories: SheetCategory[];
  items: SheetItem[];
}

interface MenuCategoryUI {
  name: string;
  items: { name: string; price: string; disclaimer: string; top: boolean }[];
  extras?: string[];
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, HttpClientModule, HttpClientJsonpModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit, OnDestroy {
  // =========================
  // CONFIG
  // =========================
  private readonly SHEET_ENDPOINT =
    'https://script.google.com/macros/s/AKfycbzR1sPg0oNxGtE6rMY4QygwGppJpM41H2PWhfeCzDSy2FFIUQz7mv25IRLQvMPPVMpI/exec';

  private readonly REFRESH_MS = 10 * 60 * 1000;
  private readonly CACHE_KEY = 'menu_config_cache_v1';

  // =========================
  // HERO SLIDER
  // =========================
  images: { url: string; name: string }[] = [
    { url: 'bgs/bg1.png', name: 'Hamburguesa Clásica' },
    { url: 'bgs/bg2.png', name: 'Toci Papas' },
    { url: 'bgs/bg3.png', name: 'Perro Clásico' },
  ];

  currentIndex = 0;
  prevIndex = this.images.length - 1;
  private sliderTimerId: any;

  // =========================
  // MENU UI
  // =========================
  sections: MenuCategoryUI[] = [];

  // =========================
  // INTERNAL
  // =========================
  private refreshSub?: Subscription;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    // 1) cache primero
    const cached = this.loadCache();
    if (cached) this.applyConfig(cached);

    // 2) inicia slider
    this.startSlider();

    // 3) polling config
    this.refreshSub = interval(this.REFRESH_MS)
      .pipe(
        startWith(0),
        switchMap(() => this.fetchSheetConfig()),
        tap((cfg) => {
          if (cfg) {
            this.saveCache(cfg);
            this.applyConfig(cfg);
          }
        })
      )
      .subscribe();
  }

  ngOnDestroy(): void {
    clearInterval(this.sliderTimerId);
    this.refreshSub?.unsubscribe();
  }

  // =========================
  // FETCH
  // =========================
  private fetchSheetConfig() {
    const url = `${this.SHEET_ENDPOINT}?t=${Date.now()}`;
    return this.http.jsonp<MenuConfigResponse>(url, 'callback').pipe(
      catchError((err) => {
        console.error('Failed to fetch sheet config:', err);
        return of(null);
      })
    );
  }

  // =========================
  // APPLY + MAP
  // =========================
  private applyConfig(cfg: MenuConfigResponse): void {
    // Images (hero slider)
    const nextImages = (cfg.images || [])
      .slice()
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map((i) => ({
        url: String(i.url || '').trim(),
        name: String(i.name || '').trim(),
      }))
      .filter((i) => i.url);

    if (nextImages.length) {
      this.images = nextImages;

      this.currentIndex = this.currentIndex % this.images.length;
      this.prevIndex =
        (this.currentIndex - 1 + this.images.length) % this.images.length;

      this.preloadImages(this.images);
    }

    // Menu vertical
    this.sections = this.mapAllCategories(cfg);
  }

  private mapAllCategories(cfg: MenuConfigResponse): MenuCategoryUI[] {
    const categories = (cfg.categories || [])
      .slice()
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    const items = (cfg.items || []).filter((i) => i.active !== false);

    return categories.map((cat) => {
      const catItems = items
        .filter((it) => it.category === cat.name)
        .slice()
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map((it) => ({
          name: String(it.name ?? '').trim(),
          price: String(it.price ?? '').trim(),
          disclaimer: String(it.disclaimer || '').trim(),
          top: !!it.top,
        }));

      const extras = String(cat.extras || '')
        .split('|')
        .map((x) => x.trim())
        .filter(Boolean);

      const out: MenuCategoryUI = { name: cat.name, items: catItems };
      if (extras.length) out.extras = extras;
      return out;
    });
  }

  // =========================
  // SLIDER
  // =========================
  private startSlider(): void {
    this.preloadImages(this.images);

    clearInterval(this.sliderTimerId);
    this.sliderTimerId = setInterval(() => {
      if (!this.images?.length) return;
      this.prevIndex = this.currentIndex;
      this.currentIndex = (this.currentIndex + 1) % this.images.length;
    }, 5000);
  }

  private preloadImages(images: { url: string }[]): void {
    images.forEach((img) => {
      const i = new Image();
      i.src = img.url;
    });
  }

  // =========================
  // CACHE
  // =========================
  private loadCache(): MenuConfigResponse | null {
    try {
      const raw = localStorage.getItem(this.CACHE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  private saveCache(cfg: MenuConfigResponse): void {
    try {
      localStorage.setItem(this.CACHE_KEY, JSON.stringify(cfg));
    } catch {}
  }
}
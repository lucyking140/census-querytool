import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
//import { provideHttpClient } from '@angular/'
import { provideHttpClient } from '@angular/common/http'; //this might need to go in main instead?

import { routes } from './app.routes';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';

export const appConfig: ApplicationConfig = {
  providers: [provideZoneChangeDetection({ eventCoalescing: true }), provideRouter(routes), provideAnimationsAsync(), provideAnimationsAsync(), provideHttpClient(),]
};

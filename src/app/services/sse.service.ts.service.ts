import { Injectable, NgZone } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SseService {
  constructor(private zone: NgZone) {}

  connect(url: string, withCredentials = false): EventSource {
    const es = new EventSource(url, { withCredentials } as any);

    console.log('[SSE] ▶️ Creando conexión:', url, 'withCreds:', withCredentials);
    console.log('[SSE] estado inicial =', es.readyState); // 0

    es.onopen = (evt) => {
      this.zone.run(() => {
        console.log('%c[SSE] 🔌 Conexión abierta', 'color: green', evt);
        console.log('[SSE] readyState =', es.readyState); // 1
      });
    };

    es.onerror = (err) => {
      this.zone.run(() => {
        console.error('%c[SSE] ❌ Error o reconexión', 'color: red', err);
        console.log('[SSE] readyState =', es.readyState);
      });
    };

    // Fallback por si llegan eventos SIN nombre (event: <omitido>)
    es.onmessage = (evt) => {
      this.zone.run(() => {
        console.log('%c[SSE] 📩 onmessage (sin nombre):', 'color: blue', evt.data);
      });
    };

    return es;
  }

  /** Registra un listener forzando la ejecución dentro de Angular */
  on(es: EventSource, type: string, handler: (data: any, raw: MessageEvent) => void) {
    es.addEventListener(type, (evt: any) => {
      this.zone.run(() => {
        let data: any = evt?.data;
        try { data = JSON.parse(evt?.data); } catch { /* puede no ser JSON */ }
        console.log(`[SSE] 🔔 "${type}"`, data);
        handler(data, evt);
      });
    });
  }
}

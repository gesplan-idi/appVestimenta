import { Component, OnInit, OnDestroy, inject, signal, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { SseService } from '../services/sse.service.ts.service';

interface User {
  id: string;
  nombre?: string;
  apellidos?: string;
  code?: number;
}
interface ApiListResponse { success: boolean; users: User[]; }

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './usuarios.component.html',
  styleUrls: ['./usuarios.component.css']
})
export class UsuariosComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private sse  = inject(SseService);
  private zone = inject(NgZone);

  users = signal<User[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);
  lastEvent = signal<string>('—');

  // usa SOLO la ruta que ya tienes
  private readonly API_LIST = 'https://my-cakephp-site.ddev.site/api/v1/users';
  private readonly STREAM   = 'https://my-cakephp-site.ddev.site/sse?debug=1';

  private es: EventSource | null = null;

  // coalescing
  private refreshTimer: any = null;
  private refreshPendiente = false;

  ngOnInit() {
    console.log('%c[USUARIOS] 🚀 init', 'color: orange');
    this.cargarUsuarios();
    this.conectarSse();
  }

  ngOnDestroy() {
    this.cerrarSse();
  }

  cargarUsuarios() {
    console.log('[USUARIOS] ⏬ cargando lista…');
    this.loading.set(true);
    this.error.set(null);

    this.http.get<ApiListResponse>(this.API_LIST).subscribe({
      next: (res) => {
        console.log('[USUARIOS] ✅ recibidos:', res?.users?.length ?? 0);
        this.users.set(res?.users ?? []);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('[USUARIOS] ❌ error list:', err);
        this.error.set(err?.message ?? 'Error cargando usuarios');
        this.loading.set(false);
      }
    });
  }

  private pedirRecargaDebounced(motivo: string) {
    this.lastEvent.set(motivo);
    this.refreshPendiente = true;
    if (this.refreshTimer) return; // ya hay un temporizador en marcha

    this.refreshTimer = setTimeout(() => {
      if (this.refreshPendiente) {
        console.log('[USUARIOS] 🔁 recargando por eventos SSE:', this.lastEvent());
        this.cargarUsuarios();
      }
      this.refreshPendiente = false;
      this.refreshTimer = null;
    }, 400); // coalesce 400ms
  }

  private conectarSse() {
    console.log('[USUARIOS] 🔗 conectando SSE…');
    this.cerrarSse();
    this.es = this.sse.connect(this.STREAM, /*withCredentials*/ false);

    // insert/update/delete → recarga coalescada
    this.sse.on(this.es, 'insert', (_d) => this.pedirRecargaDebounced('insert'));
    this.sse.on(this.es, 'update', (_d) => this.pedirRecargaDebounced('update'));
    this.sse.on(this.es, 'delete', (_d) => this.pedirRecargaDebounced('delete'));

    // mensajes genéricos (por si el backend no pone "event: nombre")
    this.es!.onmessage = (evt) => {
      this.zone.run(() => {
        console.log('[USUARIOS] ℹ️ message (sin nombre):', evt.data);
        this.pedirRecargaDebounced('message');
      });
    };
  }

  cerrarSse() {
    if (this.es) {
      console.warn('[USUARIOS] 🔒 cerrando SSE');
      this.es.close();
      this.es = null;
    }
  }
}

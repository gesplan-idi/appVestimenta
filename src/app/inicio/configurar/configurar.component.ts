import { AfterViewInit, Component, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { PrendasMap, VistaKey } from '../../interfaces/interfaces';
import { CapitalizePipe } from '../../pipes/capitalize.pipe';
import prendasJson from '../../../assets/data/prendas.json';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import Swal from 'sweetalert2';


type Align = 'left' | 'center' | 'right';
type VistaAll = 'frontal' | 'trasera' | 'perfilDer' | 'perfilIzq';

interface Texto {
  id: number;
  contenido: string;
  color: string;
  left: number;
  top: number;
  w?: number;
  h?: number;
  align?: Align;
}

interface ImgItem {
  id: number;
  src: string;
  left: number;
  top: number;
  w: number;
  h: number;
}

@Component({
  selector: 'app-configurar',
  standalone: true,
  imports: [CommonModule, FormsModule, CapitalizePipe,RouterModule],
  templateUrl: './configurar.component.html',
  styleUrl: './configurar.component.css'
})
export class ConfigurarComponent implements AfterViewInit {

  @ViewChild('divFrontal') divFrontal?: ElementRef;
  @ViewChild('divTrasera') divTrasera?: ElementRef;
  @ViewChild('logoFrontal') logoFrontal?: ElementRef<HTMLElement>;
  @ViewChild('editorRef') editorRef!: ElementRef<HTMLElement>;
  @ViewChild('msg', { static: true }) msg!: ElementRef;

  prendasJson: PrendasMap = prendasJson as PrendasMap;
  prendasEntries = Object.entries(this.prendasJson);
  prendaSeleccionada: string = '';
  vistaActual: VistaKey = 'frontal';
  imagenUrl: string = '';
  prenda: PrendasMap[keyof PrendasMap] | undefined = this.prendasJson[this.prendaSeleccionada];

  // Estado general
 contenidoTxt: string[] = [];
  sinLogo: boolean = false;
  logoGesplan: string = 'assets/images/logos/gesplan/Logotipo_Negro.png';

  // Imágenes por vista
  private imagenIdCounter = 0;
  imagesByView: Record<VistaAll, ImgItem[]> = {
    frontal: [],
    trasera: [],
    perfilDer: [],
    perfilIzq: []
  };

  // Textos por vista
  private textoIdCounter = 0;
  textosFrontal: Texto[] = [];
  textosTrasera: Texto[] = [];
  textosPerfilDer: Texto[] = [];
  textosPerfilIzq: Texto[] = [];

  // Selección
  textoSeleccionadoId: number | null = null;
  trackById = (_: number, item: { id: number }) => item.id;

  // Panel herramientas
  tamanosFuente: number[] = [8,10, 12, 14, 16, 18, 20, 22, 24, 28, 32, 36, 40];
  private fontSizeMap: Record<number, number> = {};
  getTxtFontSize(id: number): number { return this.fontSizeMap[id] ?? 16; }
  getFuenteActual(): number { const t = this.textoSeleccionado; return t ? (this.fontSizeMap[t.id] ?? 16) : 16; }

  // Otros
  public codigoProyecto: string = '';
  public generandoPDF: boolean = false;
  public jsonInvalido = false;

  // Posiciones del logo “fijo” frontal
  posiciones = {
    frontal: { left: 0, top: 0 },
    trasera: { left: 0, top: 0 },
    imagenFrontal: { left: 95, top: 200 }
  };

  // Orden de navegación
  readonly ordenDerecha: VistaKey[] = ['frontal', 'perfilDer', 'trasera', 'perfilIzq'];

 constructor(private http: HttpClient) {
  fetch('assets/data/prendas.json')
    .then(r => { if (!r.ok) throw new Error('No se pudo cargar el JSON de prendas'); return r.json(); })
    .then((data: PrendasMap) => {
      this.prendasJson = data;
      this.prendasEntries = Object.entries(this.prendasJson);
      if (!this.prendasEntries.length) throw new Error('JSON vacío');

      // ✅ Seleccionar la 8.ª prenda (índice 7) con control de límites
      const idxInicial = 9;
      const idxSeguro = Math.min(Math.max(idxInicial, 0), this.prendasEntries.length - 1);

      this.prendaSeleccionada = this.prendasEntries[idxSeguro][0];
      this.prenda = this.prendasJson[this.prendaSeleccionada];

      this.leerArchivoTxt('assets/' + (this.prenda?.text ?? 'data/info.txt'));

      // ✅ Evitar "Cannot redeclare block-scoped variable 'vistas'"
      const vistasDisp = this.getVistasDisponibles();
      this.vistaActual = vistasDisp.includes('frontal')
        ? 'frontal'
        : (vistasDisp[0] as VistaKey || 'trasera');

      this.actualizarImagen();

      setTimeout(() => {
        const editor = document.querySelector('.camiseta-editor') as HTMLElement;
        if (editor) {
          const centerX = editor.clientWidth / 2;
          this.posiciones.imagenFrontal = { left: centerX - 100, top: editor.clientHeight * 0.2 };
          this.posiciones.frontal = { left: centerX - 60, top: editor.clientHeight * 0.60 };
          this.posiciones.trasera = { left: centerX - 60, top: editor.clientHeight * 0.20 };
        }
      });

      // (opcional) repetir si quieres forzar refresco tras el setTimeout:
      this.actualizarImagen();
    })
    .catch(err => {
      console.error('❌ Error al cargar el JSON de prendas:', err);
      this.jsonInvalido = true;
    });
}


  ngAfterViewInit(): void {
    this.reinyectarTexto();
    this.editorRef?.nativeElement.addEventListener('click', () => { this.textoSeleccionadoId = null; });
    setTimeout(() => { this.setInicioLogoFrontal(); this.resetLogoFrontalPosition(); }, 100);
  }

  // ¿Hay algo que resetear? (cualquier texto o imagen en cualquier vista)
  get hasAnyContent(): boolean {
    const imgs =
      // si usas el nuevo esquema con imágenes por vista:
      (this as any).imagesByView
        ? Object.values((this as any).imagesByView as Record<string, any[]>).some(arr => arr?.length > 0)
        // compatibilidad: si aún tienes solo imagenesTrasera
        : (Array.isArray((this as any).imagenesTrasera) && (this as any).imagenesTrasera.length > 0);

    // textos en todas las vistas que existan en tu clase
    const tFr = Array.isArray((this as any).textosFrontal) ? (this as any).textosFrontal.length : 0;
    const tTr = Array.isArray((this as any).textosTrasera) ? (this as any).textosTrasera.length : 0;
    const tPd = Array.isArray((this as any).textosPerfilDer) ? (this as any).textosPerfilDer.length : 0;
    const tPi = Array.isArray((this as any).textosPerfilIzq) ? (this as any).textosPerfilIzq.length : 0;

    return imgs || (tFr + tTr + tPd + tPi) > 0;
  }

  // 🔴 Reset total: borra textos e imágenes agregadas en TODAS las vistas
  resetTodo(): void {
    // Imágenes (nuevo esquema por vista)
    if ((this as any).imagesByView) {
      const ibv = (this as any).imagesByView as Record<string, any[]>;
      Object.keys(ibv).forEach(k => ibv[k] = []);
    }
    // Compatibilidad: esquema anterior solo con imagenesTrasera
    if (Array.isArray((this as any).imagenesTrasera)) {
      (this as any).imagenesTrasera = [];
    }

    // Textos (borra los de todas las vistas que existan)
    if (Array.isArray((this as any).textosFrontal)) (this as any).textosFrontal = [];
    if (Array.isArray((this as any).textosTrasera)) (this as any).textosTrasera = [];
    if (Array.isArray((this as any).textosPerfilDer)) (this as any).textosPerfilDer = [];
    if (Array.isArray((this as any).textosPerfilIzq)) (this as any).textosPerfilIzq = [];

    // Selección y tamaños
    this.textoSeleccionadoId = null;
    this.fontSizeMap = {};

    // (Opcional) Si quieres también limpiar el texto “legacy” de reinyectarTexto:
    // this.textoFrontalLegacy = 'Tu Texto';
    // this.textoTraseraLegacy = 'Tu Texto';
  }


  // ====== Getters útiles ======
  get textoSeleccionado(): Texto | null {
    const arr = this.getTextosByVista(this.vistaActual as VistaAll);
    return arr.find(t => t.id === this.textoSeleccionadoId) || null;
  }

  get hasTextTools(): boolean {
    return this.getTextosByVista(this.vistaActual as VistaAll).length > 0;
  }

  getAlignActual(): Align | null {
    const t = this.textoSeleccionado;
    return t ? (t.align ?? 'left') : null;
  }

  // ====== Alineación / tamaño / color ======
  cambiarTamanoFuente(value: number) {
    const t = this.textoSeleccionado; if (!t) return;
    const size = Number(value); if (!Number.isFinite(size)) return;
    this.fontSizeMap[t.id] = size;
  }
  // Seleccionar un cuadro de texto (para habilitar las herramientas y saber a cuál aplicar color/tamaño/align)
  seleccionarTexto(id: number, event?: Event): void {
    if (event) event.stopPropagation(); // evita que el click burbujee al editor
    this.textoSeleccionadoId = id;
  }

  cambiarAlineacionTexto(align: Align): void {
    const t = this.textoSeleccionado;
    if (!t) return;
    const vista = this.vistaActual as VistaAll;
    const arr = this.getTextosByVista(vista);
    const idx = arr.findIndex(x => x.id === t.id);
    if (idx >= 0) {
      const nuevo = [...arr];
      nuevo[idx] = { ...nuevo[idx], align };
      this.setTextosByVista(vista, nuevo);
    }
  }

  cambiarColorTexto(color: string) {
    const t = this.textoSeleccionado;
    if (!t) return;
    t.color = color;
    const vista = this.vistaActual as VistaAll;
    const arr = this.getTextosByVista(vista);
    const idx = arr.findIndex(x => x.id === t.id);
    if (idx >= 0) {
      const nuevo = [...arr];
      nuevo[idx] = { ...nuevo[idx], color };
      this.setTextosByVista(vista, nuevo);
    }
  }

  // ====== Logo fijo frontal ======
  private setInicioLogoFrontal(): void {
    const editor = this.editorRef?.nativeElement;
    const logo = this.logoFrontal?.nativeElement;
    if (!editor || !logo) { setTimeout(() => this.setInicioLogoFrontal(), 50); return; }
    const w = (logo.querySelector('img') as HTMLImageElement)?.clientWidth || 60;
    this.posiciones.imagenFrontal.top = 95;
    this.posiciones.imagenFrontal.left = editor.clientWidth - 145 - w;
  }

  // ====== Imágenes (todas las vistas) ======
  agregarImagen() {
    if (this.prenda?.logos === 99) return; // seguridad
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.jpeg,.jpg,.png,.svg';

    input.onchange = (event: Event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const fileName = file.name.toLowerCase();
      const allowedExtensions = ['.jpeg', '.jpg', '.png', '.svg'] as const;
      const dotIdx = fileName.lastIndexOf('.');
      const fileExtension = dotIdx >= 0 ? fileName.substring(dotIdx) : '';

      if (!allowedExtensions.includes(fileExtension as (typeof allowedExtensions)[number])) {
        Swal.fire({
          title: 'Error!',
          text: 'Solo se permiten archivos con extensiones .jpeg, .jpg, .png o .svg',
          icon: 'error',
          confirmButtonText: 'Ok'
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const tmp = new Image();
        tmp.onload = () => {
          const base = 120;
          const k = tmp.width >= tmp.height ? base / tmp.width : base / tmp.height;
          const w = Math.round(tmp.width * k);
          const h = Math.round(tmp.height * k);

          const vista = this.vistaActual as VistaAll;
          const nuevo: ImgItem = {
            id: this.imagenIdCounter++,
            src: reader.result as string,
            left: 50,
            top: 50,
            w, h
          };
          this.imagesByView[vista] = [...this.imagesByView[vista], nuevo];
        };
        tmp.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  borrarImagen(vista: VistaAll, id: number) {
    this.imagesByView[vista] = this.imagesByView[vista].filter(img => img.id !== id);
  }
  /** Recoloca el logo frontal (id === -1) a su posición inicial por defecto */
private resetLogoFrontalPosition(): void {
  const editor = this.editorRef?.nativeElement;
  // si el editor o la imagen aún no están listos, reintenta un poco después
  if (!editor) { setTimeout(() => this.resetLogoFrontalPosition(), 50); return; }

  // anchura del logo (si está disponible). Usa un estimado si aún no cargó.
  const logoEl = this.logoFrontal?.nativeElement?.querySelector('img') as HTMLImageElement | null;
  const logoW = logoEl?.clientWidth || 60;

  // MISMO cálculo que tu inicio: top fijo y left pegado a la derecha con margen
  this.posiciones.imagenFrontal.top  = 95;
  this.posiciones.imagenFrontal.left = editor.clientWidth - 145 - logoW;
}


 // VistaAll si ya lo tienes tipado; si no, usa: vista: 'frontal'|'trasera'|'perfilDer'|'perfilIzq'
iniciarArrastreImagen(event: MouseEvent, vista: 'frontal'|'trasera'|'perfilDer'|'perfilIzq', id: number) {
  event.preventDefault();
  const editorEl = this.editorRef?.nativeElement;
  if (!editorEl) return;

  // ✅ CASO ESPECIAL: logo predeterminado del FRONTAL (id === -1)
  if (id === -1 && vista === 'frontal') {
    const logoHost = this.logoFrontal?.nativeElement; // <div class="logo-flotante">...</div>
    if (!logoHost) return;

    const startX = event.clientX;
    const startY = event.clientY;
    const initialLeft = this.posiciones.imagenFrontal.left;
    const initialTop  = this.posiciones.imagenFrontal.top;

    // tamaño real del contenedor del logo para limitar dentro del editor
    const boxW = logoHost.offsetWidth  || 100;
    const boxH = logoHost.offsetHeight || 100;

    const onMove = (e: MouseEvent) => {
      let newLeft = initialLeft + (e.clientX - startX);
      let newTop  = initialTop  + (e.clientY - startY);

      const maxLeft = editorEl.clientWidth  - boxW;
      const maxTop  = editorEl.clientHeight - boxH;

      this.posiciones.imagenFrontal.left = Math.max(0, Math.min(newLeft, maxLeft));
      this.posiciones.imagenFrontal.top  = Math.max(0, Math.min(newTop,  maxTop));
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return; // importante: no seguir a la rama de imágenes normales
  }

  // ✅ IMÁGENES NORMALES (añadidas por el usuario) EN CUALQUIER VISTA
  const arr = this.imagesByView?.[vista];
  if (!arr) return;
  const ref = arr.find(i => i.id === id);
  if (!ref) return;

  const startX = event.clientX;
  const startY = event.clientY;
  const initialLeft = ref.left;
  const initialTop  = ref.top;

  const boxW = (event.currentTarget as HTMLElement).clientWidth  || ref.w || 100;
  const boxH = (event.currentTarget as HTMLElement).clientHeight || ref.h || 100;

  const onMove = (e: MouseEvent) => {
    let newLeft = initialLeft + (e.clientX - startX);
    let newTop  = initialTop  + (e.clientY - startY);

    const maxLeft = editorEl.clientWidth  - boxW;
    const maxTop  = editorEl.clientHeight - boxH;

    ref.left = Math.max(0, Math.min(newLeft, maxLeft));
    ref.top  = Math.max(0, Math.min(newTop,  maxTop));
  };

  const onUp = () => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    // Forzar actualización inmutable (opcional, por si Angular no refresca)
    const idx = arr.findIndex(i => i.id === id);
    if (idx >= 0) {
      const nuevo = [...arr];
      nuevo[idx] = { ...ref };
      this.imagesByView[vista] = nuevo;
    }
  };

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}


  iniciarResizeImagen(event: MouseEvent, vista: VistaAll, id: number) {
    event.preventDefault();
    event.stopPropagation();

    const editor = this.editorRef.nativeElement;
    const arr = this.imagesByView[vista];
    const ref = arr.find(i => i.id === id);
    if (!ref) return;

    const caja = (event.currentTarget as HTMLElement).parentElement as HTMLElement;
    const startX = event.clientX;
    const startW = ref.w;
    const startH = ref.h;
    const ratio = startW / (startH || 1) || 1;

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      let newW = startW + dx;
      let newH = Math.round(newW / ratio);

      newW = Math.max(40, newW);
      newH = Math.max(40, newH);

      const maxW = editor.clientWidth - ref.left;
      const maxH = editor.clientHeight - ref.top;
      if (newW > maxW) { newW = maxW; newH = Math.round(newW / ratio); }
      if (newH > maxH) { newH = maxH; newW = Math.round(newH * ratio); }

      caja.style.width = `${newW}px`;
      caja.style.height = `${newH}px`;
      ref.w = newW; ref.h = newH;
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      const idx = arr.findIndex(i => i.id === id);
      if (idx >= 0) {
        const nuevo = [...arr];
        nuevo[idx] = { ...ref };
        this.imagesByView[vista] = nuevo;
      }
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  // ====== Textos (todas las vistas) ======
  private getTextosByVista(v: VistaAll): Texto[] {
    switch (v) {
      case 'frontal': return this.textosFrontal;
      case 'trasera': return this.textosTrasera;
      case 'perfilDer': return this.textosPerfilDer;
      case 'perfilIzq': return this.textosPerfilIzq;
    }
  }
  private setTextosByVista(v: VistaAll, arr: Texto[]) {
    switch (v) {
      case 'frontal': this.textosFrontal = arr; break;
      case 'trasera': this.textosTrasera = arr; break;
      case 'perfilDer': this.textosPerfilDer = arr; break;
      case 'perfilIzq': this.textosPerfilIzq = arr; break;
    }
  }

  agregarTexto() {
    if (this.prenda?.logos === 99) return;
    const v = this.vistaActual as VistaAll;
    const arr = this.getTextosByVista(v);
    const nuevo: Texto = { id: this.textoIdCounter++, contenido: 'Nuevo texto', color: '#000000', left: 50, top: 50, w: 260, h: 48, align: 'left' };
    this.setTextosByVista(v, [...arr, nuevo]);
    this.textoSeleccionadoId = nuevo.id;
    this.fontSizeMap[nuevo.id] = 16;
  }

  borrarTexto(id: number, vista: VistaAll) {
    const arr = this.getTextosByVista(vista).filter(t => t.id !== id);
    this.setTextosByVista(vista, arr);
    if (this.textoSeleccionadoId === id) this.textoSeleccionadoId = null;
    delete this.fontSizeMap[id];
  }

  commitTexto(value: string, id: number, vista: VistaAll) {
    const arr = this.getTextosByVista(vista);
    const idx = arr.findIndex(x => x.id === id);
    if (idx >= 0) {
      const nuevo = [...arr];
      nuevo[idx] = { ...nuevo[idx], contenido: value };
      this.setTextosByVista(vista, nuevo);
    }
  }

  iniciarArrastreTexto(event: MouseEvent, id: number, vista: VistaAll) {
    event.preventDefault();
    event.stopPropagation();
    const arr = this.getTextosByVista(vista);
    const texto = arr.find(t => t.id === id);
    if (!texto) return;

    const startX = event.clientX, startY = event.clientY;
    const initialLeft = texto.left, initialTop = texto.top;

    const onMouseMove = (e: MouseEvent) => {
      texto.left = initialLeft + (e.clientX - startX);
      texto.top = initialTop + (e.clientY - startY);
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      const idx = arr.findIndex(t => t.id === id);
      if (idx >= 0) {
        const nuevo = [...arr];
        nuevo[idx] = { ...texto };
        this.setTextosByVista(vista, nuevo);
      }
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  iniciarResizeTexto(event: MouseEvent, id: number, vista: VistaAll) {
    event.preventDefault();
    event.stopPropagation();

    const editor = this.editorRef.nativeElement;
    const arr = this.getTextosByVista(vista);
    const ref = arr.find(t => t.id === id);
    if (!ref) return;

    const caja = (event.currentTarget as HTMLElement).parentElement as HTMLElement;
    const startX = event.clientX;
    const startY = event.clientY;
    const startW = ref.w ?? caja.clientWidth;
    const startH = ref.h ?? caja.clientHeight;

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;

      let newW = Math.max(80, startW + dx);
      let newH = Math.max(28, startH + dy);

      const maxW = editor.clientWidth - ref.left;
      const maxH = editor.clientHeight - ref.top;
      newW = Math.min(newW, maxW);
      newH = Math.min(newH, maxH);

      caja.style.width = `${newW}px`;
      caja.style.height = `${newH}px`;
      ref.w = newW; ref.h = newH;
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      const idx = arr.findIndex(t => t.id === id);
      if (idx >= 0) {
        const nuevo = [...arr];
        nuevo[idx] = { ...ref };
        this.setTextosByVista(vista, nuevo);
      }
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  // ====== Utilidades varias ======
  getNombrePrenda([_, data]: [string, { nombre: string }]): string { return data.nombre; }
  onRightArrowClick(): void { this.cambiarVista(1); }
  onLeftArrowClick(): void { this.cambiarVista(-1); }

  private cambiarVista(direccion: 1 | -1): void {
    const vistas = this.getVistasDisponibles();
    if (vistas.length === 0) return;
    let idx = vistas.indexOf(this.vistaActual);
    idx = idx === -1 ? 0 : (idx + direccion + vistas.length) % vistas.length;
    this.vistaActual = vistas[idx];

    this.textoSeleccionadoId = null; // reset selección
    this.actualizarImagen();
    this.reinyectarTexto();
  }

  private getVistasDisponibles(): VistaKey[] {
    const prenda = this.prendasJson[this.prendaSeleccionada];
    this.logoGesplan = `assets/images/logos/gesplan/${prenda.valor}`;
    const vistasPrenda = prenda?.vistas ?? {};
    return this.ordenDerecha.filter(v => v in vistasPrenda) as VistaKey[];
  }

  actualizarImagen(): void {
    const prenda = this.prendasJson[this.prendaSeleccionada];
    this.prenda = prenda;
    this.sinLogo = prenda.logos === 99;
    this.leerArchivoTxt('assets/' + (prenda.text ?? 'data/info.txt'));
    const ruta = prenda?.vistas[this.vistaActual]?.ruta;
    if (ruta) this.imagenUrl = `assets/${ruta}`;
  }

  onPrendaChange(): void {
    const vistas = this.getVistasDisponibles();
    this.vistaActual = vistas.includes('frontal') ? 'frontal' : (vistas[0] as VistaKey || 'trasera');
    this.textoSeleccionadoId = null;
    this.actualizarImagen();
    this.reinyectarTexto();
    setTimeout(() => this.resetLogoFrontalPosition(), 100);
  }

  onImagenSeleccionada(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = () => { this.logoGesplan = reader.result as string; };
      reader.readAsDataURL(file);
    }
  }

  onTextoChange(vista: 'frontal' | 'trasera', event: Event): void {
    const text = (event.target as HTMLElement).innerText;
    if (vista === 'frontal') this.textoFrontalLegacy = text; else this.textoTraseraLegacy = text;
  }

  // Mantener compatibilidad con funciones legadas (si se usaban en otro sitio)
  private textoFrontalLegacy = 'Tu Texto';
  private textoTraseraLegacy = 'Tu Texto';

  reinyectarTexto(): void {
    setTimeout(() => {
      if (this.vistaActual === 'frontal' && this.divFrontal) {
        this.divFrontal.nativeElement.innerText = this.textoFrontalLegacy;
      } else if (this.vistaActual === 'trasera' && this.divTrasera) {
        this.divTrasera.nativeElement.innerText = this.textoTraseraLegacy;
      }
    });
  }

  resetearTextoYPosicion(): void {
    this.textoFrontalLegacy = 'Tu Texto';
    this.textoTraseraLegacy = 'Tu Texto';
    this.logoGesplan = '';

    const editor = document.querySelector('.camiseta-editor') as HTMLElement;
    if (editor) {
      const centerX = editor.clientWidth / 2;
      const centerY = editor.clientHeight / 2;

      this.posiciones.frontal = { left: centerX - 60, top: centerY };
      this.posiciones.trasera = { left: centerX - 60, top: centerY };
      this.posiciones.imagenFrontal = { left: centerX - 40, top: centerY - 120 };
    }

    this.reinyectarTexto();
  }

filtrarPorProveedor(event: any): void {
  // Normaliza texto: sin acentos, sin puntuación, sin espacios, minúsculas
  const normalize = (s?: string) =>
    String(s ?? '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quita acentos
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '')                      // quita puntos, comas, espacios, etc.
      .trim();

  const valor = typeof event === 'string'
    ? event
    : (event?.target?.value ?? '');

  const valueNorm = normalize(valor);

  // Siempre partimos del JSON completo
  const todas = Object.entries(this.prendasJson);

  if (!valueNorm || valueNorm === 'todos') {
    // Mostrar todo
    this.prendasEntries = todas.slice();
  } else {
    // Filtra por proveedor con normalización robusta
    this.prendasEntries = todas.filter(
      ([, prenda]) => normalize(prenda.proveedor) === valueNorm
    );
  }

  // Asegura que haya selección válida tras el filtrado
  const sigue = this.prendasEntries.some(([k]) => k === this.prendaSeleccionada);
  if (!sigue) {
    this.prendaSeleccionada = this.prendasEntries[0]?.[0] ?? '';
    if (this.prendaSeleccionada) this.onPrendaChange();
    else {
      // Sin resultados: limpia estado mínimo visible
      this.prenda = undefined;
      this.imagenUrl = '';
      this.contenidoTxt = [];
    }
  }
}




  // ====== PDF helpers (sin cambios relevantes) ======
  private createOffscreenClone(el: HTMLElement): { cloneHost: HTMLElement; clone: HTMLElement; cleanup: () => void } {
    const host = document.createElement('div');
    Object.assign(host.style, { position: 'fixed', left: '-10000px', top: '0', width: `${el.clientWidth}px`, height: `${el.clientHeight}px`, zIndex: '-1' } as CSSStyleDeclaration);
    document.body.appendChild(host);
    const clone = el.cloneNode(true) as HTMLElement;
    host.appendChild(clone);

    const srcInputs = el.querySelectorAll('input');
    const dstInputs = clone.querySelectorAll('input');
    srcInputs.forEach((s, i) => { const d = dstInputs[i] as HTMLInputElement | undefined; if (d) d.value = (s as HTMLInputElement).value; });

    return { cloneHost: host, clone, cleanup: () => document.body.removeChild(host) };
  }

 private pdfSwapInputsForSpans(root: HTMLElement) {
  const replaced: Array<{ from: HTMLElement; to: HTMLElement }> = [];

  const nodes = root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
    '.texto-flotante input.texto-input, .texto-flotante textarea.texto-input'
  );

  nodes.forEach((el) => {
    // 1) Leemos su valor real (incluye saltos de línea)
    const value = (el as HTMLInputElement | HTMLTextAreaElement).value ?? '';

    // 2) Creamos un div render que rellena la caja del texto
    const render = document.createElement('div');
    render.className = 'texto-render';
    render.textContent = value; // 👈 preserva \n

    // 3) Copiamos estilos esenciales del campo original
    const cs = getComputedStyle(el);
    Object.assign(render.style, {
      position: 'absolute',
      inset: '0',                             // ocupa toda la caja
      background: 'transparent',
      border: '0',
      padding: `${cs.paddingTop} ${cs.paddingRight} ${cs.paddingBottom} ${cs.paddingLeft}`,
      color: cs.color,
      fontSize: cs.fontSize,
      lineHeight: cs.lineHeight,
      fontFamily: cs.fontFamily,
      fontWeight: cs.fontWeight,
      textAlign: cs.textAlign as any,
      whiteSpace: 'pre-wrap',                 // 👈 CLAVE: muestras \n
      overflowWrap: 'anywhere',
      wordBreak: 'break-word',
      display: 'block',
    } as CSSStyleDeclaration);

    // 4) Insertamos el render sin quitar el original (lo ocultamos para mantener layout)
    el.style.visibility = 'hidden';
    el.parentElement?.appendChild(render);

    replaced.push({ from: el, to: render });
  });

  // función para revertir
  return () => {
    replaced.forEach(({ from, to }) => {
      to.remove();
      from.style.visibility = '';
    });
  };
}


  private freezeElementSizes(root: HTMLElement, selector: string): () => void {
    const restores: Array<() => void> = [];
    const els = Array.from(root.querySelectorAll(selector)) as HTMLElement[];
    els.forEach(el => {
      const prevW = el.style.width;
      const prevH = el.style.height;
      const r = el.getBoundingClientRect();
      el.style.width = `${r.width}px`;
      el.style.height = `${r.height}px`;
      restores.push(() => { el.style.width = prevW; el.style.height = prevH; });
    });
    return () => restores.forEach(fn => fn());
  }

  private hideUiKeepLayout(root: HTMLElement): () => void {
    const restores: Array<() => void> = [];
    const uiEls = Array.from(root.querySelectorAll('.btn-cerrar, .handle-mover, .handle-resize')) as HTMLElement[];
    uiEls.forEach(el => { const prev = el.style.display; el.style.display = 'none'; restores.push(() => { el.style.display = prev; }); });
    const bordered = Array.from(root.querySelectorAll('.texto-flotante, .logo-flotante')) as HTMLElement[];
    bordered.forEach(el => { const prev = el.style.border; const cs = getComputedStyle(el); el.style.border = `${cs.borderTopWidth} ${cs.borderTopStyle} transparent`; restores.push(() => { el.style.border = prev; }); });
    return () => restores.forEach(fn => fn());
  }

  private collectContentRectsAndHideLogos(root: HTMLElement): {
    editorRect: DOMRect;
    overlays: Array<{ x: number; y: number; w: number; h: number; src: string }>;
    restore: () => void;
  } {
    const editorRect = root.getBoundingClientRect();
    const overlays: Array<{ x: number; y: number; w: number; h: number; src: string }> = [];
    const restores: Array<() => void> = [];

    const boxes = Array.from(root.querySelectorAll('.logo-flotante')) as HTMLElement[];
    boxes.forEach(box => {
      const img = box.querySelector('img') as HTMLImageElement | null;
      if (!img || !img.naturalWidth || !img.naturalHeight) return;

      const br = box.getBoundingClientRect();
      const boxW = br.width, boxH = br.height;
      const iw = img.naturalWidth, ih = img.naturalHeight;

      const k = Math.min(boxW / iw, boxH / ih);
      const drawW = iw * k, drawH = ih * k;
      const offX = (boxW - drawW) / 2;
      const offY = (boxH - drawH) / 2;

      overlays.push({
        x: (br.left - editorRect.left) + offX,
        y: (br.top - editorRect.top) + offY,
        w: drawW, h: drawH, src: img.src
      });

      const prevVis = box.style.visibility;
      box.style.visibility = 'hidden';
      restores.push(() => { box.style.visibility = prevVis; });
    });

    return { editorRect, overlays, restore: () => restores.forEach(fn => fn()) };
  }

leerArchivoTxt(ruta: string) {
  this.http.get(ruta, { responseType: 'text' }).subscribe({
    next: (data) => {
      // dividimos por guion y limpiamos espacios
      this.contenidoTxt = data
        .split('-')
        .map(l => l.trim())
        .filter(l => l.length > 0);
    },
    error: (error) => {
      console.error('Error al leer el archivo:', error);
      this.contenidoTxt = ['No se pudo cargar el contenido del archivo.'];
    }
  });
}

async generarPDF() {
  this.generandoPDF = true;

  // ===== Helpers ligeros =====
  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

  function downscaleCanvas(src: HTMLCanvasElement, maxW: number): HTMLCanvasElement {
    if (src.width <= maxW) return src;
    const s = maxW / src.width;
    const w = Math.max(1, Math.round(src.width * s));
    const h = Math.max(1, Math.round(src.height * s));
    const tmp = document.createElement('canvas');
    tmp.width = w; tmp.height = h;
    const ctx = tmp.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(src, 0, 0, w, h);
    return tmp;
  }

  async function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((res, rej) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = src;
    });
  }

  // Reescala overlay manteniendo transparencia (PNG) para que pese menos.
  async function optimizeOverlayPNG(src: string, maxDim = 1200): Promise<string> {
    try {
      const img = await loadImage(src);
      const maxSide = Math.max(img.width, img.height);
      if (maxSide <= maxDim) return src; // ya es pequeño

      const scale = maxDim / maxSide;
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const ctx = c.getContext('2d', { alpha: true })!;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(img, 0, 0, w, h);
      return c.toDataURL('image/png'); // mantiene alpha
    } catch {
      // Si falla algo de CORS/decodificación, devolvemos el original.
      return src;
    }
  }

  // ======== Código original, con compresión añadida ========

  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });
  const vistas = this.getVistasDisponibles();
  const real = this.editorRef?.nativeElement as HTMLElement;
  if (!real || vistas.length === 0) { this.generandoPDF = false; return; }

  const imagenes: string[] = [];
  const edRects: Array<{ w: number; h: number }> = [];
  const overlaysByView: Array<Array<{ x: number; y: number; w: number; h: number; src: string }>> = [];

  // --- Captura por vista (igual que antes) ---
  for (const vista of vistas) {
    this.vistaActual = vista;
    this.actualizarImagen();
    await sleep(300);

    const { cloneHost, clone, cleanup } = this.createOffscreenClone(real);
    const unfreezeLogos = this.freezeElementSizes(clone, '.logo-flotante');
    const unfreezeTexts = this.freezeElementSizes(clone, '.texto-flotante');
    const unhideUi = this.hideUiKeepLayout(clone);
    const undoTextSwap = this.pdfSwapInputsForSpans(clone);

    const { editorRect, overlays, restore: restoreLogos } = this.collectContentRectsAndHideLogos(clone);

    await new Promise(r => requestAnimationFrame(r));

    // ↓↓↓ reducción de resolución (antes: Math.max(3, devicePixelRatio))
    const scale = 2;

    const canvas = await html2canvas(clone, {
      backgroundColor: '#ffffff',
      scale,
      useCORS: true,
      imageTimeout: 0,
      logging: false
    });

    restoreLogos(); undoTextSwap(); unhideUi(); unfreezeTexts(); unfreezeLogos(); cleanup();

    // ↓↓↓ reescala el bitmap base a un ancho máximo razonable (2000px) y codifica en JPEG (ligero)
    const ds = downscaleCanvas(canvas, 2000);
    imagenes.push(ds.toDataURL('image/jpeg', 0.75));

    edRects.push({ w: editorRect.width, h: editorRect.height });
    overlaysByView.push(overlays);
  }

  // ↓↓↓ optimizamos los overlays (PNG con alpha) para que no pesen tanto
  const overlaysOptimizedByView: Array<Array<{ x: number; y: number; w: number; h: number; src: string }>> = [];
  for (let i = 0; i < overlaysByView.length; i++) {
    const arr = overlaysByView[i];
    const out: Array<{ x: number; y: number; w: number; h: number; src: string }> = [];
    for (const o of arr) {
      const optimizedSrc = await optimizeOverlayPNG(o.src, 1200); // ajusta 1200→1000 si quieres menos peso
      out.push({ ...o, src: optimizedSrc });
    }
    overlaysOptimizedByView.push(out);
  }

  const pageWidth  = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;

  // ========= PÁGINA 1: portada 2x2 + cabecera =========
  {
    const prendaNombre: string = String(this.prenda?.nombre ?? '').trim();
    const titulo = `Resumen de Diseño: ${prendaNombre.toUpperCase()}`;
    const maxTextW = pageWidth - margin * 2;

    let y = 15;

    pdf.setFontSize(14);
    const titleLines = pdf.splitTextToSize(titulo, maxTextW);
    pdf.text(titleLines, margin, y);
    const titleDims = (pdf as any).getTextDimensions
      ? pdf.getTextDimensions(titleLines)
      : { h: titleLines.length * 6 };
    y += titleDims.h + 2;

    const codigoProyecto: string = String(
      (this as any).codigoProyecto ?? (this as any).codigo ?? (this as any).codigoEncargo ?? ''
    ).trim();

    if (codigoProyecto) {
      pdf.setFontSize(11);
      const codeLine = `Código de proyecto: ${codigoProyecto}`;
      const codeLines = pdf.splitTextToSize(codeLine, maxTextW);
      pdf.text(codeLines, margin, y);
      const codeDims = (pdf as any).getTextDimensions
        ? pdf.getTextDimensions(codeLines)
        : { h: codeLines.length * 5 };
      y += codeDims.h;
    }

    const topGridY = y + 10;
    const gridW = pageWidth - margin * 2;
    const gridH = pageHeight - topGridY - margin;

    const cols = 2, rows = 2;
    const gapX = 12;
    const gapY = 14;
    const captionH = 6;

    const cellW = (gridW - gapX * (cols - 1)) / cols;
    const cellH = (gridH - gapY * (rows - 1)) / rows;
    const imgAreaH = cellH - captionH;

    const startX = margin;
    const startY = topGridY;

    const etiqueta = (v: string) => {
      const n = v.toLowerCase();
      if (n.includes('frontal')) return 'FRONTAL';
      if (n.includes('trasera') || n.includes('espalda')) return 'TRASERA';
      if (n.includes('izq')) return 'PERFIL IZQUIERDO';
      if (n.includes('der')) return 'PERFIL DERECHO';
      return v.toUpperCase();
    };

    const usados = new Set<number>();
    const pick = (rx: RegExp) => {
      const i = vistas.findIndex((v, k) => rx.test(v.toLowerCase()) && !usados.has(k));
      if (i >= 0) usados.add(i);
      return i;
    };
    const indices: number[] = [];
    [ /frontal/, /(trasera|espalda)/, /izq/, /der/ ].forEach(rx => {
      const i = pick(rx);
      if (i >= 0) indices.push(i);
    });
    vistas.forEach((_, i) => { if (!usados.has(i) && indices.length < 4) indices.push(i); });

    const numCeldas = Math.min(4, indices.length);

    for (let idx = 0; idx < numCeldas; idx++) {
      const col = idx % cols;
      const row = Math.floor(idx / cols);

      const cellX = startX + col * (cellW + gapX);
      const cellY = startY + row * (cellH + gapY);

      const i = indices[idx];
      const edW = edRects[i].w;
      const edH = edRects[i].h;

      const s = Math.min(cellW / edW, imgAreaH / edH);

      const drawW = edW * s;
      const drawH = edH * s;
      const x = cellX + (cellW - drawW) / 2;
      const yImg = cellY + (imgAreaH - drawH) / 2;

      // Imagen base (JPEG ligera)
      pdf.addImage(imagenes[i], 'JPEG', x, yImg, drawW, drawH, undefined, 'FAST');

      // Overlays (PNG optimizados, conservan transparencia)
      const ovs = overlaysOptimizedByView[i];
      for (const o of ovs) {
        pdf.addImage(o.src, 'PNG', x + o.x * s, yImg + o.y * s, o.w * s, o.h * s);
      }

      const label = etiqueta(vistas[i]);
      pdf.setFontSize(9);
      const textW = pdf.getTextWidth(label);
      const textX = cellX + (cellW - textW) / 2;
      const labelY = cellY + imgAreaH + captionH - 2;
      pdf.text(label, textX, labelY);
    }
  }

  // ========= PÁGINAS SIGUIENTES =========
  const pageWidth2  = pdf.internal.pageSize.getWidth();
  const pageHeight2 = pdf.internal.pageSize.getHeight();

  for (let i = 0; i < imagenes.length; i++) {
    pdf.addPage();

    const edW = edRects[i].w, edH = edRects[i].h;
    const maxW = pageWidth2 - margin * 2;
    const maxH = pageHeight2 - (20 + 10);
    const s = Math.min(maxW / edW, maxH / edH);

    const drawW = edW * s, drawH = edH * s;
    const x = margin + (maxW - drawW) / 2;
    const y = 20 + (maxH - drawH) / 2;

    pdf.setFontSize(14);
    pdf.text(`Vista: ${vistas[i].toUpperCase()}`, margin, 15);

    // Base (JPEG ligero)
    pdf.addImage(imagenes[i], 'JPEG', x, y, drawW, drawH, undefined, 'FAST');

    // Overlays (PNG optimizados)
    const ovs = overlaysOptimizedByView[i];
    for (const o of ovs) {
      pdf.addImage(o.src, 'PNG', x + o.x * s, y + o.y * s, o.w * s, o.h * s);
    }
  }

  // ========= Nombre de archivo =========
  const prendaNombre: string = String(this.prenda?.nombre ?? '').trim();
  const codigoProyecto: string = String(
    (this as any).codigoProyecto ?? (this as any).codigo ?? (this as any).codigoEncargo ?? ''
  ).trim();

  const sanitize = (s: string) =>
    s
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\-]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');

  const safeCode = sanitize(codigoProyecto || 'SIN_CODIGO');
  const safeName = sanitize(prendaNombre || 'SIN_NOMBRE');
  pdf.save(`${safeCode}_${safeName}.pdf`);

  this.vistaActual = 'frontal';
  this.actualizarImagen();
  this.reinyectarTexto();
  this.generandoPDF = false;
}





}

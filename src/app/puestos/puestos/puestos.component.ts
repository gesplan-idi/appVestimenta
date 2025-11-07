import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import hotspots from '../../../assets/hotspots/hotspots.json';

interface Hotspot {
  id: string;
  label: number;
  cx: number;
  cy: number;
  r: number;
  hitR?: number;
}

type ReserveMode = 'single' | 'weekdays';

@Component({
  selector: 'app-puestos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './puestos.component.html',
  styleUrl: './puestos.component.css'
})
export class PuestosComponent {
  pdfW = 1191;
  pdfH = 842;
  planSrc = 'assets/hotspots/plano-oficina.png';

  hotspots: Hotspot[] = (hotspots as Hotspot[]).map(h => ({ ...h }));
  selected: Hotspot | null = null;

  // Modal/Form
  showDialog = false;            // ⬅⬅ arranca cerrado
  mode: ReserveMode = 'single';
  date = '';

  constructor() {
    // ajustar radio de click para evitar solapes
    const n = this.hotspots.length;
    for (let i = 0; i < n; i++) {
      const a = this.hotspots[i];
      let minD = Number.POSITIVE_INFINITY;
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const b = this.hotspots[j];
        const d = Math.hypot(a.cx - b.cx, a.cy - b.cy);
        if (d < minD) minD = d;
      }
      const candidate = Math.min(a.r, Math.floor(minD * 0.4));
      a.hitR = Math.max(10, Math.min(22, candidate));
    }
  }

  trackById = (_: number, h: Hotspot) => h.id;

  onHotspotClick(h: Hotspot, ev: Event) {
    ev.stopPropagation();
    this.selected = h;
    this.mode = 'single';
    this.date = '';
    this.showDialog = true;
  }

  cancelDialog() {
    this.showDialog = false;
    this.selected = null;
  }

  acceptDialog() {
    if (!this.selected) return;
    if (!this.date) { alert('Selecciona una fecha.'); return; }

    const dates = this.mode === 'single' ? [this.date] : this.computeWeekdays(this.date);
    console.log('Reserva:', { puesto: this.selected.label, modo: this.mode, fechas: dates });
    alert(`Reservado puesto ${this.selected.label} para:\n${dates.join(', ')}`);
    this.cancelDialog();
  }

  private computeWeekdays(isoDate: string): string[] {
    const base = new Date(isoDate + 'T00:00:00');
    const jsDay = base.getDay();           // 0..6 (0=domingo)
    const iso = jsDay === 0 ? 7 : jsDay;   // 1..7 (1=lunes)
    const monday = new Date(base);
    monday.setDate(base.getDate() - (iso - 1));
    const days: string[] = [];
    for (let i = 0; i < 5; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      days.push(d.toISOString().slice(0, 10));
    }
    return days;
  }
}

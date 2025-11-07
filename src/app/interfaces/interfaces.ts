export type VistaKey = 'frontal' | 'trasera' | 'perfilIzq' | 'perfilDer';

export interface Vista {
  nombre: string;
  ruta: string;
 
}

export type ValorPrenda = '1' | '2' | '0';

export interface Prenda {
  nombre: string;
  valor: ValorPrenda;
  proveedor?: string;
  text?: string;
  logos?: number; // 0 = ninguno, 1 = uno, 2 = dos, 99 = ilimitados
  vistas: {
    [key in VistaKey]?: Vista;
  };
}

export type PrendasMap = Record<string, Prenda>;



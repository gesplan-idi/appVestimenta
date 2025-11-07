import { Routes } from '@angular/router';

import { ConfigurarComponent } from './inicio/configurar/configurar.component';
import { PuestosComponent } from './puestos/puestos/puestos.component';
import { UsuariosComponent } from './usuarios/usuarios.component';

export const routes: Routes = [
  {
    path: 'inicio/configurar',
    component: ConfigurarComponent
  },
   {
    path: 'puestos/puestos',
    component: PuestosComponent
  },
   {
    path: 'usuarios/usuarios',
    component: UsuariosComponent
  },
  {
    path: '',
    redirectTo: 'inicio/configurar',
    pathMatch: 'full'
  }
];

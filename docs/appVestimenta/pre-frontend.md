# appVestimenta PRE — Frontend Angular

## CI/CD

El repositorio `appVestimenta` construye y publica la imagen Docker del frontend, pero no despliega en EKS.

Workflow:

`.github/workflows/build-frontend.yml`

Nombre:

`Frontend - Build and Push`

Modelo operativo:

- `pull_request` hacia `pre` o `main`: valida Angular, tests si existen y build Docker sin publicar imagen.
- `push` a `pre`: compila, construye la imagen y la publica en ECR PRE.
- `workflow_dispatch`: valida manualmente y permite publicar PRE si `publish_pre=true`.
- El despliegue Helm/Kubernetes se realiza desde `infra-apps`.

El workflow no ejecuta `helm`, `kubectl`, Terraform ni despliegues directos a EKS.

## Imagen

ECR PRE:

`674624358677.dkr.ecr.eu-west-1.amazonaws.com/gesplan-pre/vestimenta-frontend`

Repositorio lógico:

`gesplan-pre/vestimenta-frontend`

Tag obligatorio:

`sha-<commit_sha>`

Ejemplo:

`674624358677.dkr.ecr.eu-west-1.amazonaws.com/gesplan-pre/vestimenta-frontend:sha-8f8d02b...`

No usar `latest` como tag de despliegue. El tag que debe consumir `infra-apps` es siempre el `sha-<commit_sha>` generado por el workflow.

## Autenticación AWS

La autenticación con AWS se hace mediante GitHub Actions OIDC.

Secret requerido:

`AWS_ROLE_ARN_PRE`

No configurar `AWS_ACCESS_KEY_ID` ni `AWS_SECRET_ACCESS_KEY` en este repositorio.

## Build frontend

Proyecto Angular detectado por:

- `package.json`
- `angular.json`
- `src/`

Dockerfile:

`Dockerfile`

Scripts npm detectados:

- `build`: `ng build`
- `test`: `ng test`

No hay script `lint` definido actualmente.

## API

La configuración objetivo para consumir el backend es usar ruta relativa:

`/api`

Estado actual detectado:

- `src/app/usuarios/usuarios.component.ts` usa `https://my-cakephp-site.ddev.site/api/v1/users`.
- `src/app/usuarios/usuarios.component.ts` usa `https://my-cakephp-site.ddev.site/sse?debug=1`.

Pendiente técnico: mover esas URLs a ruta relativa o configuración runtime, sin introducir secretos ni dominios PRO en el build.

## Namespace

`gesplan-pre-vestimenta`

## Helm release

`vestimenta-frontend`

## Service

`vestimenta-frontend`

Puerto:

`80`

## Validaciones post-despliegue

Estas validaciones aplican después de desplegar desde `infra-apps`, no desde el workflow de `appVestimenta`.

```powershell
kubectl get pods -n gesplan-pre-vestimenta
kubectl port-forward svc/vestimenta-frontend 8081:80 -n gesplan-pre-vestimenta
curl.exe -I http://localhost:8081/
curl.exe -I http://localhost:8081/health
```

## Pendiente

- Actualizar `image.tag` en `infra-apps` con el tag `sha-<commit_sha>` generado.
- Integrar con backend mediante Ingress.
- Activar OAuth2 Proxy específico de Vestimenta.
- Crear Ingress definitivo.
- Crear DNS funcional `vestimenta-pre.gesplan.es`.

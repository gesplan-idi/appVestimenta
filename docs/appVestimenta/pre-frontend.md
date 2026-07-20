# appVestimenta PRE — Frontend Angular

## CI/CD

El repositorio `appVestimenta` construye y publica la imagen Docker del frontend, pero no despliega en EKS.

Workflow:

`.github/workflows/build-frontend.yml`

Nombre:

`Frontend - Build and Push`

Modelo operativo:

- `pull_request` hacia `pre` o `main`: valida Angular, tests si existen y build Docker sin publicar imagen.
- No se publica en `push` a `pre`.
- `workflow_dispatch` desde `pre` permite publicar PRE si `publish_pre=true` y la confirmación es exacta.
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

## Publicación PRE endurecida

PRE se publica exclusivamente desde la rama `pre`; `main` queda reservada para PRO futuro y PRO no está habilitado. El job de validación de Pull Request no obtiene credenciales AWS, no publica imágenes y no ejecuta Helm, kubectl ni Terraform.

La publicación real requiere `workflow_dispatch`, `environment=pre`, `publish_pre=true`, ref exacta `refs/heads/pre` y confirmación `PUBLISH_VESTIMENTA_FRONTEND_PRE`. La cuenta, región, repositorio ECR y caller ARN se verifican antes del login. La imagen usa exactamente `sha-${GITHUB_SHA}` con 40 caracteres hexadecimales y el dispatch se limita a `gesplan-idi/infra-apps`, evento `deploy-vestimenta-pre`, componente `frontend` y rama origen `pre`.

La concurrencia `publish-vestimenta-frontend-pre` evita publicaciones paralelas. El rol compartido `gesplan-github-actions-pre` es temporal; el rol ECR específico de frontend debe definirse, aplicarse y añadirse a la allowlist en otro cambio. No se requiere EKS Access/RBAC en este repositorio.

GitHub Team reforzará la protección de ramas/Environments si la licencia contratada lo permite; estos guards no simulan required reviewers.

### Actions fijadas por SHA

| Action | Versión | SHA verificado | Fuente | Estado |
|---|---|---|---|---|
| `actions/checkout` | v4 | `34e114876b0b11c390a56381ad16ebd13914f8d5` | referencia oficial GitHub | fijada |
| `actions/setup-node` | v4 | `49933ea5288caeca8642d1e84afbd3f7d6820020` | referencia oficial GitHub | fijada |
| `aws-actions/configure-aws-credentials` | v4 | `7474bc4690e29a8392af63c5b98e7449536d5c3a` | commit oficial de tag | fijada |
| `aws-actions/amazon-ecr-login` | v2 | `d539f0932e70871a027e9d5a9d8fc38589180a64` | referencia oficial GitHub | fijada |
| `actions/create-github-app-token` | v2 | `fee1f7d63c2ff003460e3d139729b119787bc349` | referencia oficial GitHub | fijada |

Rollback: revertir el commit del workflow. Las imágenes ya publicadas son inmutables y no se eliminan; el despliegue se revierte desde `infra-apps` seleccionando un tag anterior.

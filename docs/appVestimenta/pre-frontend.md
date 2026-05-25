# appVestimenta PRE — Frontend Angular

## Imagen

ECR:

`674624358677.dkr.ecr.eu-west-1.amazonaws.com/gesplan-pre/vestimenta-frontend:pre`

## Namespace

`gesplan-pre-vestimenta`

## Helm release

`vestimenta-frontend`

## Service

`vestimenta-frontend`

Puerto:

`80`

## Validaciones

```powershell
kubectl get pods -n gesplan-pre-vestimenta
kubectl port-forward svc/vestimenta-frontend 8081:80 -n gesplan-pre-vestimenta
curl.exe -I http://localhost:8081/
curl.exe -I http://localhost:8081/health
Pendiente
Integrar con backend mediante Ingress.
Activar OAuth2 Proxy específico de Vestimenta.
Crear Ingress definitivo.
Crear DNS funcional vestimenta-pre.gesplan.es.
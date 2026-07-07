# Monitoring Installation Guide

## Prerequisites

- Kubernetes Cluster
- Helm
- kubectl

## Create Namespace

```bash
kubectl apply -f manifests/namespace.yaml
```

## Add Helm Repository

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts

helm repo update
```

## Deploy Monitoring Stack

```bash
helm install depi-monitoring prometheus-community/kube-prometheus-stack \
-n monitoring \
-f helm/custom-values.yaml
```

## Verify Installation

```bash
kubectl get pods -n monitoring
```

Expected Output:

All Pods should be Running.

# DEPI Cluster Overview Dashboard

## Purpose

This dashboard provides a high-level overview of the Kubernetes cluster health.

It is intended to give DevOps engineers a quick understanding of the cluster status before investigating application-level issues.

---

## Dashboard Layout

This dashboard contains six main panels:

1. Total Nodes
2. Ready Nodes
3. Total Pods
4. Running Pods
5. CPU Usage
6. Memory Usage

---

## Panel 1

### Name

Total Nodes

### Goal

Display the total number of Kubernetes nodes inside the cluster.

### Metric

kube_node_info

### Query

```promql
count(kube_node_info)
```

### Expected Result

Shows the number of registered Kubernetes nodes.

---

## Panel 2

### Name

Ready Nodes

### Goal

Display the number of healthy nodes.

### Metric

kube_node_status_condition

### Query

```promql
count(kube_node_status_condition{condition="Ready",status="true"})
```

### Expected Result

Shows the number of nodes ready to schedule workloads.

---

## Panel 3

### Name

Total Pods

### Goal

Display the total number of Pods running inside the cluster.

### Query

```promql
count(kube_pod_info)
```

---

## Panel 4

### Name

Running Pods

### Goal

Display the number of Pods currently in Running state.

### Query

```promql
count(kube_pod_status_phase{phase="Running"})
```

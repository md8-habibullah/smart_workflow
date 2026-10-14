> **Note:** This document predates the React rewrite and may be outdated (it may mention the removed Flutter app). The current, maintained documentation is in [docs/ai/](ai/README.md).

# Smart Task Allocation Engine - Mathematical Specification

## Objective
The Smart Task Allocation Engine recommends suitable employees for task assignments by evaluating candidate eligibility, skill match, workload balance, availability, and deadline fit.

## Fixed Weight Distribution

| Component | Weight | Mathematical Symbol | Description |
| :--- | :--- | :--- | :--- |
| **Skill Match** | **40%** | $W_S = 0.40$ | Degree to which employee skills meet/exceed required levels |
| **Workload Balance** | **25%** | $W_W = 0.25$ | Safe remaining capacity ratio |
| **Availability** | **20%** | $W_A = 0.20$ | Active task commitment count deduction |
| **Deadline Fit** | **15%** | $W_D = 0.15$ | Capacity fit before deadline |

$$ \text{Final Score} = (S_{\text{Skill}} \times 0.40) + (S_{\text{Workload}} \times 0.25) + (S_{\text{Availability}} \times 0.20) + (S_{\text{Deadline}} \times 0.15) $$

---

## Step 1: Candidate Eligibility Filtering

An employee is marked **INELIGIBLE** if any of the following conditions fail:
1. Account status is not `APPROVED` or `is_active` is false.
2. Employee lacks any skill required by the task.
3. Employee's proficiency score is below the minimum required score ($S_{\text{emp}} < S_{\text{required}}$).
4. Employee is excluded by project membership rules.

*When an employee is ineligible, explicit failure reasons are returned in the API response.*

---

## Step 2: Component Score Calculation (0 – 100 Scale)

### 1. Skill Match Score ($S_{\text{Skill}}$)
Proficiency Scores:
- `BEGINNER` = 25
- `INTERMEDIATE` = 50
- `ADVANCED` = 75
- `EXPERT` = 100

$$ S_{\text{Skill}} = \frac{1}{N} \sum_{i=1}^{N} \min\left(100, \frac{\text{EmployeeScore}_i}{\text{RequiredScore}_i} \times 100\right) $$

### 2. Workload Balance Score ($S_{\text{Workload}}$)
Default Weekly Capacity $C_{\text{weekly}} = \text{Daily Capacity} \times 5 = 40\text{ hours}$.

$$ \text{Remaining Capacity } C_{\text{rem}} = \max(0, C_{\text{weekly}} - H_{\text{assigned}}) $$

$$ S_{\text{Workload}} = \min\left(100, \frac{C_{\text{rem}}}{C_{\text{weekly}}} \times 100\right) $$

### 3. Availability Score ($S_{\text{Availability}}$)

$$ S_{\text{Availability}} = \max(0, 100 - (15 \times \text{Active Task Count})) $$

### 4. Deadline Fit Score ($S_{\text{Deadline}}$)

$$ S_{\text{Deadline}} = \begin{cases} 100 & \text{if } H_{\text{task}} \le C_{\text{rem}} \\ \max\left(0, 100 - \frac{H_{\text{task}} - C_{\text{rem}}}{H_{\text{task}}} \times 100\right) & \text{if } H_{\text{task}} > C_{\text{rem}} \end{cases} $$

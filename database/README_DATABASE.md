# Smart Workforce System - Database Central Monitoring Hub (ডাটাবেজ মনিটরিং গাইড)

এই `database/` ফোল্ডারটিতে প্রজেক্টের সমস্ত SQL স্ক্রিপ্ট, ডাটাবেজ স্কিমা, ভিউ, ট্রানজেকশন, রিপোর্টিং কুয়েরি এবং ERD ডায়াগ্রাম এক জায়গায় রাখা হয়েছে যাতে আপনি খুব সহজেই সিস্টেমের ডাটাবেজ মনিটর ও টেস্ট করতে পারেন।

---

## 📁 ফোল্ডারের ফাইলসমূহ (Directory Contents)

| ফাইল (Filename) | কাজ ও ব্যবহার (Description) |
| :--- | :--- |
| **`schema_reference.sql`** | সম্পূর্ণ ৩য় নরমাল ফর্ম (3NF) ডাটাবেজ ও ১৪টি টেবিল তৈরির মূল SQL স্ক্রিপ্ট। |
| **`V1__initial_schema.sql`** | ব্যাকএন্ড ভার্সনড মাইগ্রেশন ফাইল (InnoDB constraints, foreign keys, CHECK clauses)। |
| **`sample_data.sql`** | ডিপার্টমেন্ট, অ্যাডমিন ইউজার, এমপ্লয়ি, স্কিল, প্রজেক্ট, টাস্ক ও ওয়ার্কলগ ইনসার্ট করার টেস্ট ডেটা। |
| **`joins.sql`** | INNER JOIN, LEFT JOIN, Multi-table JOIN এর প্রেজেন্টেশন কুয়েরিসমূহ। |
| **`reports.sql`** | GROUP BY, HAVING, Subquery এবং Aggregation রিপোর্ট (Overloaded Employees, Overdue Tasks)। |
| **`views.sql`** | সহজ মনিটরিং ও ড্যাশবোর্ড অ্যানালিটিক্স এর জন্য Database Views (`v_active_task_allocations`, `v_employee_skill_matrix`, `v_department_workload_summary`)। |
| **`transactions.sql`** | ACID প্রপার্টি, রো-লেভেল লকিং ও রোলব্যাক ট্রানজেকশন ডেমো (Task Reassignment, User Approval)। |
| **`indexes.sql`** | সার্চ ও জয়েন কুয়েরির গতি বাড়াতে Performance Indexing। |
| **`ERD.md`** | সিস্টেমের Entity Relationship Diagram (Mermaid Diagram) ও রিলেশনশিপসমূহ। |
| **`DATABASE_DESIGN.md`** | 1NF, 2NF, 3NF নরমালইজেশন এবং কনস্ট্রেইন্ট ডকুমেন্টস। |

---

## 🚀 MySQL Workbench-এ রান ও মনিটর করার ধারাবাহিক নিয়ম (Execution Order)

ডাটাবেজ এক জায়গা থেকে সম্পূর্ণ মনিটর করতে MySQL Workbench ওপেন করে নিচের ক্রমানুসারে স্ক্রিপ্টগুলো রান করুন:

### ১ম ধাপ: ডাটাবেজ ও টেবিল তৈরি করুন
MySQL Workbench এ `schema_reference.sql` ওপেন করে **Execute (Lightning Icon)** প্রেস করুন।
- এটি `smart_workforce_db` ডাটাবেজ ও ১৪টি টেবিল তৈরি করবে।

### ২য় ধাপ: টেস্ট ডেটা যুক্ত করুন
`sample_data.sql` ফাইলটি ওপেন করে রান করুন।
- এটি অ্যাডমিন ইউজার (`admin@smartworkflow.org`), টেস্ট এমপ্লয়ি, স্কিল ও টাস্ক ডাটা ইনসার্ট করবে।

### ৩য় ধাপ: ড্যাশবোর্ড ভিউসমূহ তৈরি করুন
`views.sql` ফাইলটি রান করুন।
- এটি ড্যাশবোর্ড ভিউসমূহ তৈরি করবে।

### ৪র্থ ধাপ: ইনডেক্সিং যুক্ত করুন
`indexes.sql` ফাইলটি রান করুন।

---

## 📊 ডাটাবেজ মনিটরিং কুয়েরিসমূহ (Quick Monitoring Queries)

MySQL Workbench এ সরাসরি যেকোনো সময় নিচের কুয়েরিগুলো চালিয়ে সিস্টেম মনিটর করতে পারবেন:

### ১. সব একটিভ টাস্ক ও অ্যাসাইনমেন্ট মনিটর করা:
```sql
USE smart_workforce_db;
SELECT * FROM v_active_task_allocations;
```

### ২. এমপ্লয়ি স্কিল ও স্কোর মনিটর করা:
```sql
SELECT * FROM v_employee_skill_matrix;
```

### ৩. ডিপার্টমেন্টভিত্তিক ওয়ার্কলগ মনিটর করা:
```sql
SELECT * FROM v_department_workload_summary;
```

### ৪. ওভারডিউ (মেয়াদোত্তীর্ণ) টাস্কসমূহ দেখা:
```sql
SELECT * FROM tasks WHERE deadline < NOW() AND status NOT IN ('COMPLETED', 'CANCELLED');
```

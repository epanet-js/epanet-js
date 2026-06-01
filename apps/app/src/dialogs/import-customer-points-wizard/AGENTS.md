Here's a summary of the wizard strategy for your data import process, presented in a single Markdown file:

---

# Data Import Wizard Strategy: Single File Summary

This document outlines the UI strategy for a multi-step data import process, implemented as a **modal wizard** with a clear **stepper** for progress indication. The design prioritizes user clarity and streamlined transitions.

---

## 1. Overall Wizard Structure

The entire process will reside within a **modal dialog**, ensuring user focus. A **stepper component** at the top will visually guide users through each step. The modal footer will consistently house global navigation buttons: **Cancel**, **Back**, and **Next/Finish**.

---

## 2. Step-by-Step Flow & Transitions

### Step 1: Choose Data Source

* **Stepper Label:** "1. Choose Data Source"
* **UI Elements:**
    * **"Upload File" Button:** Active, with text explaining supported file types (e.g., ".csv, .xlsx, .json").
    * **"Connect to Third-Party Service" Button:** Visually muted (e.g., greyed out), **disabled**, and labeled "Coming Soon."
* **Footer Buttons:** "Cancel" (active, far left), "Back" (disabled), "Next" (disabled).
* **Transitions:**
    * **User clicks "Upload File":** This action directly triggers the operating system's **file selection dialog**.
    * **User selects a file:** Once a file is chosen and confirmed in the file picker, the wizard automatically **advances to Step 2**.
    * **User cancels file selection:** Wizard remains on Step 1, awaiting file selection.

### Step 2: Data Handling

* **Stepper Label:** "2. Data Handling"
* **UI Elements:**
    * **Question:** "How do you want to handle the imported data?"
    * **Radio Buttons:**
        * "**Override Existing Data**": Replaces current data.
        * "**Add to Existing Data**": Merges new data with existing.
    * *(Optional)* Small data preview of the loaded file.
* **Validation:** User must select one option to proceed.
* **Footer Buttons:** "Cancel" (active), "Back" (active, returns to Step 1), "Next" (enabled after option selected).
* **Transitions:**
    * **User clicks "Next":** Wizard advances to Step 3.
    * **User clicks "Back":** Wizard returns to Step 1.

### Step 3: Summary & Completion

* **Stepper Label:** "3. Summary"
* **UI Elements:**
    * **Status Indicator:** Prominent success (green) or failure (red) message.
    * **Summary Details:**
        * **On Success:** Records processed, new/updated records, optional link to view imported data.
        * **On Failure:** Explanation of failure, number of failed records, optional link/button for detailed error log.
* **Footer Buttons:** "Cancel" (renamed "Close" or "Done" on success), "Back" (disabled), and a prominent **"Finish" / "Close" / "Done" button** (replaces "Next").
* **Transitions:**
    * **User clicks "Finish"/"Close"/"Done":** Modal closes, user returns to the main application.
    * *(On Failure)* **"Try Again" button (optional):** Resets wizard and returns to Step 1.

---

## 3. Button Placement (Consistent Footer Layout)

The modal footer will consistently display buttons in this order:

`[ Cancel Button ] [ Back Button ]           [ Next Button ] / [ Finish Button ]`

* **Cancel:** Far left, always active, closes wizard.
* **Back:** To the right of Cancel, enabled from Step 2 onwards.
* **Next/Finish:** Far right, contextually enabled (Next on valid steps, Finish on final summary).

---

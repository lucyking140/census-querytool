# Query Builder tool for the International Trade API

This tool allows users to submit parameters to generate an API call, then to submit the call and view the resulting data. It is supported by a Flask API to handle processing the parameters returned by the Trade API.

# Installation

Create and activate a new conda environment. Then, in the querytool_start folder, run the following commands:

### Angular

conda install nodejs=18.19  
npm i -g @angular/cli  
cd querytool  
npm install  
npm install xlsx

### Flask

conda install flask  
conda install requests

### Other Notes

We've had the most luck when installing Angular in local drives. Certain network drives seem to prevent npm from accessing the correct package-lock.json file, and instead incorrectly default to a version in restricted C::/Windows folder. Angular also runs very, very slowly on the network drives, so for ease of use it is recommended to copy the querytool_start folder (without node_modules) into your local drive and follow these instructions there.

# Opening the App

Every time you access the app locally, you will need to open two terminals, one to run the Flask API in querytool_start/data_services and another in querytool_start/querytool to run the Angular frontend.

Once in the correct directories with your conda environment activated, run the following commands:

Angular frontend in querytool_start/querytool: ng serve  
Flask API in querytool_start/data_services: flask --app app run

# Structural Overview

### Database Selection Component

Main component that handles the initial parameter selection (dataset, time interval, etc.), displays the parameter selection dropdown, and displays the data table.

### Param Dropdown Component

Component specifically for the parameter dropdown, to handle the search bar, collecting the parameters from the Flask API in the correct format, and to handle paramter selection. Interacts with the param selection service frequently. This component is created recursively for each tiered layer of the dropdown.

### Data Service

Handles basic data processing for the database-selection component. This includes formatting the API call from the currently selected parameters, formatting the data table returned by the Flask API into a JSON object to display, and exporting the data table. Also formats any errors resulting from the Flask or Trade APIs. This is the only frontend component that interacts directly with the Flask API or the Trade API.

### Param Selection Service

Implements any functionality that persists accross layers of the dropdown (and thus instances of the param-dropdown component). Stores the parameters that have been selected, any names or codes that are excluded for paired parameters, and tracks invalid COMM_LVL and commodity selections.

### Flask API

Supports direct interaction with the Trade API. Handles formatting for the param dropdown, including retreiving the valid parameters for the given initial params, formatting tiered params, and handling paired params.

NOTE: When this is no longer locally hosted, the URL used to access it will need to change. This change will need to occur in src/app/data.service in the getAllParams method in line 117.

### Other Supporting Features

- Template Dialog component:  
  Template for all dialogs, currently primarily used for loading and error dialogs.
- Param Check validator:  
  Handles initial parameter validation, ensuring the start date is before the end date and the end date is prior to present day.

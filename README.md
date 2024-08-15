# Query Builder tool for the International Trade API

This tool allows users to submit parameters to generate an API call, then to submit the call and view the resulting data. It is supported by a Flask API 


## Installation

# Angular
conda install nodejs=18.19
npm i -g @angular/cli
npm install
ng add @angular/material

# Flask
Conda install flask
Conda install requests


# Other Notes
Uses Python 3.12.3 

To run:
Angular frontend in querytool_start/querytool: ng serve 
Flask API in querytool_start/data_service: flask --app app run

## Overview

# Database Selection

Main component that handles the initial parameter selection (dataset, time interval, etc.), displays the parameter selection dropdown, and displays the data table.

# Param Dropdown

Component specifically for the parameter dropdown, to handle the search bar, collecting the parameters from the Flask API in the correct format, and to handle paramter selection. Interacts with the param selection service frequently. This component is created recursively for each tiered layer of the dropdown.

# Data Service

Handles basic data processing for the database-selection component. This includes formatting the API call from the currently selected parameters, formatting the data table returned by the Flask API into a JSON object to display, and exporting the data table. Also formats any errors resulting from the Flask or Trade APIs. This is the only frontend component that interacts directly with the Flask API or the Trade API. 

# Param Selection Service

Implements any functionality that persists accross layers of the dropdown (and thus instances of the param-dropdown component). Stores the parameters that have been selected, any names or codes that are excluded for paired parameters, and tracks invalid COMM_LVL and commodity selections. 

# Flask API

Supports direct interaction with the Trade API. Handles formatting for the param dropdown, including retreiving the valid parameters for the given initial params, formatting tiered params, and handling paired params. 

# Other Supporting Features

- Template Dialog component:
    Template for all dialogs, currently primarily used for loading and error dialogs. 
- Param Check validator:
    Handles initial parameter validation, ensuring the start date is before the end date and the end date is prior to present day.



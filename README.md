# Query builder tool for the International Trade API

This tool allows users to submit parameters to generate an API call, then to submit the call and view the resulting data. It is supported by a Flask API to handle processing the parameters returned by the Trade API.

The US Census Bureau's International Trade API is a comprehensive resource for accessing import and export data across nine separate commodity classification systems, each with up to ten thousand commodity codes and hundreds of origin/destination trading partners. Because the API is frequently used by economists and policy writers unfamiliar with API call formatting, this query portal seeks to provide an accessible interface that pulls the currently-avaliable parameters from the API, formats a user's query, and provides the requested data.

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

import json
from flask import Flask, jsonify, request
import requests
from collections import defaultdict
from utils import make_tiers, getCountryJSON, getTimeString
import functools
import time

app = Flask(__name__)

apiUrl = "https://api.census.gov/data/timeseries/intltrade/"

keyString = "&key=e1da9a37eb7e1064e772d42c26760baeb0f245a4"

#list of commodity parameters and the character code lengths
tiered_param_lengths = {
    "E_COMMODITY" : [2, 4, 6, 10], 
    "E_ENDUSE": [1, 5],
    "NAICS": [2,3,4,6],
    "E_ENDUSE": [1, 5],
    "I_COMMODITY":[2,4,6,10], #CHANGED from I_COMMUNITY
    "I_ENDUSE": [1,5],
}

#params that we handle internally or don't use
exclude_params = [
    "name", 
    "time", 
    "MONTH", 
    "YEAR", 
    "SUMMARY_LVL2",
    "LAST_UPDATE"
]

#params that don't have options ever -- mostly values. These are separated to increase efficiency, so
# we aren't submitting API calls checking for these values
# NOTE: this is not a comprehensive list and removing params from this list or having other non-included select-only params won't change the functionality
# of the getAllParams methods, it just can shorten the Trade API call if we remove as many guaranteed select-only params as possible.
select_only_params = [
    "CNT_WGT_YR",
    "CNT_VAL_MO",
    "AIR_WGT_MO",
    "VES_WGT_MO",
    "CNT_VAL_YR",
    "AIR_WGT_YR",
    "CNT_WGT_MO",
    "VES_WGT_YR",
    "ALL_VAL_MO",
    "AIR_VAL_MO",
    "ALL_VAL_YR",
    "VES_VAL_MO",
    "VES_VAL_YR",
    "AIR_VAL_YR",
    "CC_YR",
    "CC_MO",
    "LAST_UPDATE"
]

#pairs of requirements that we include together
#could be cleaned up by looking for <param>_SDESC for most of these
paired_params = {
    "CTY_CODE": ["CTY_NAME", "Country name"],
    "DISTRICT":["DIST_NAME", "District name"],
    "E_COMMODITY": ["E_COMMODITY_SDESC", "50-char commodity description"],
    "E_ENDUSE": ["E_ENDUSE_SDESC", "50-char commodity description"], #ADDED, enduse
    "PORT": ["PORT_NAME", "Port name"], #ADDED, porths
    "HITECH": ["HITECH_DESC", "50-char commodity description"],
    "NAICS" : ["NAICS_SDESC", "50-char commodity description"],
    "SITC" : ["SITC_SDESC", "50-char commodity description"],
    "I_ENDUSE": ["I_ENDUSE_SDESC", "50-char commodity description"],
    "I_COMMODITY": ["I_COMMODITY_SDESC", "50-char commodity description"]
}

#List of options for COMM_LVL on various endpoints. Used because these aren't 
# automatically listed as params
comm_lvl_options = {
    "hs": ["HS2", "HS4", "HS6", "HS10"],
    "naics": ["NA2", "NA3", "NA4", "NA6"],
    "sitc": [],
    "statenaics": ["NA2", "NA3", "NA4"],
    "porths": ["HS2", "HS4", "HS6"],
    "statehs":["HS2", "HS4", "HS6"],
    "enduse": ["EU1", "EU5"],
    "hitech": [],
    "usda": []
}

"""
# Not currently in use -- all errors are processed through data service in angular frontend
@app.errorhandler(Exception)
def handle_errors(e):
    response = {
        "error": str(e),
        "Message": "An unexpected error occured"
    }
    print("Reaching handle_errors with message: ", str(e))

    resp = jsonify(response)
    resp.headers.add('Access-Control-Allow-Origin', '*')

    return resp, 500
"""

"""
Sends paired parameter list. Used to reduce the number of places this list needs to be updated.
"""
@app.route('/paired-params', methods=['GET'])
def get_paired_params():
    output = jsonify(paired_params)
    #print("jsonified params: ", output)
    output.headers.add('Access-Control-Allow-Origin', '*')
    return output

"""
Gets all datasets given either imports or exports.
NOT CURRENTLY IN USE

@app.route('/datasets', methods=['GET'])
def get_datasets(exports):

    exp = "exports" if exports else "imports"
    try:
        response = requests.get(apiUrl + exports)
        print("Reaching try")
        raise Exception("test exception")
    except Exception as e:
        print("reaching catch")
        raise Exception("Failed to access the Census API: " + e)

    result = response["dataset"]["c_dataset"]

    return jsonify(result)
"""

"""
Handles collecting the list of variables and params shown in the sidebar dropdown
Separately handles CTY_CODE (format <continent><3 more digits>) and tiered params
as listed above (see utils function)
"""
@app.route('/all_params', methods=['GET'])
def get_all_params():
    startTime = time.time()    
    dataset = request.args.get('dataset')
    exp = request.args.get('exports') #CHANGED TO EXP from exports
    start = request.args.get('start') #year-month formate
    end = request.args.get('end')
    
    #print("Getting varibales from API: ", startTime - time.time())
    #REMOVED -- exp = "exports" if exports else "imports"
    ## getting the list of variables overall
    try: 
        response = requests.get(apiUrl + exp + "/" + dataset + "/variables/")
        response.raise_for_status()
        result = response.json()
    except Exception as e:
        e_message =  f'An error accessing the Census API occured: {e}'
        output = jsonify({'error': e_message})
        output.headers.add('Access-Control-Allow-Origin', '*')
        return output, 500
   
    #eliminating repeated variables from the time params (vars will be repeated for each unique month)
    new_results = set()
    for res in result:
        new_results.add(tuple(res[:-1]))
    result = [list(subopt) for subopt in new_results]

    """
    all_params is the primary collection of parameters, in a list of the form
    [{name: xx, category: xx, options: xx}]
    Name is the parameter name, category is the type of param, so for names like CANADA
    category would be CTY_NAME, and options is the list of the values for that given option, in the 
    same format as all_params overall. 
    This is meant to support tiered params, hence the category variable, so "options" can refer to the
    values directly associated with the name (e.g. CTY_CODE will have options CANADA, DOMINICAN REPUBLIC, etc.)
    but also tiered params, so 01 (LIVE ANIMALS) commodity code would have (0110, 0112, etc) as options.
    """
    all_params = []
    flat_search_params = []
    time_string = getTimeString(start, end)

    done_vars = []
    commodity_vars = []
    get_string = "" #accumulates all params to be handled regularly
    comm_get_string = "" #for commodities specificially
    
    ## Iterate through each var, handling it either in its own special case or by collecting all possible 
    # options for it from the API
    for var in result:
        print("VAR: ", var[0:2])

        shown_name = var[0:2]
        
        # We either don't support these parameters (exclude_params) or incorporate them automatically later (PP values)
        if var[0] in exclude_params or var[0] in [i[0] for i in paired_params.values()]:
            done_vars.append(var[0])
            continue

        # We include all params in this list for the dropdown search bar
        flat_search_params.append({"name": var[0:2], "category": var[0]})

        # Automatically adding descriptions here, because they aren't included automatically
        if var[0] == "DF":
            done_vars.append(var[0])
            flat_search_params.append({"name": ["1", "Domestic"], "category": var[0]})
            flat_search_params.append({"name": ["2", "Foreign"], "category": var[0]})
            sl_opts = [{"name": ["1", "Domestic"], "category": var[0], "options": []}, {"name": ["2", "Foreign"], "category": var[0], "options": []}]
            all_params.append({"name": shown_name, "category": var[0], "options": sl_opts})
            continue

        #these values are hard-coded because they don't show up when queried
        if var[0] == "SUMMARY_LVL": 
            done_vars.append(var[0])
            flat_search_params.append({"name": "DET", "category": var[0]})
            flat_search_params.append({"name": "CGP", "category": var[0]})
            sl_opts = [{"name": "DET", "category": var[0], "options": []}, {"name": "CGP", "category": var[0], "options": []}]
            all_params.append({"name": shown_name, "category": var[0], "options": sl_opts})
            continue

        # Handled uniquely because this is a unique tiered structure of continents and countries
        if var[0] == "CTY_CODE":
            done_vars.append(var[0])
            cty_options, flat_cty_options = getCountryJSON((apiUrl + exp + "/" + dataset + "?get=" + var[0] + ",CTY_NAME" + time_string))
            all_params.append({"name": shown_name, "category": var[0], "options": cty_options })
            for o in flat_cty_options:
                flat_search_params.append(o)
            continue

        if var[0] == "USDA" or var[0] == "STATE" or var[0] in paired_params:
            commodity_vars.append(var[0])

        # these are just separated to reduce the burden on the API call to make it faster
        if var[0] in select_only_params:
            done_vars.append(var[0])
            all_params.append({"name": shown_name, "category": var[0], "options": []})
            continue

        #adding comm_lvl options to valid endpoints
        if var[0] == "COMM_LVL":
            done_vars.append(var[0])
            options = comm_lvl_options[dataset]
            #process them!
            opts = []
            for param in options:
                flat_search_params.append({"name": param, "category": var[0]})
                opts.append({"name": param, "category": var[0], "options": []})
            if opts != []: #not included if not avaliable for this endpoint
                all_params.append({"name": shown_name, "category": var[0], "options": opts})
            continue

        #adding paired_param to the get-string
        if var[0] in commodity_vars:
            if var[0] == "USDA" or var[0] == "STATE":
                comm_get_string += var[0] + ","
            else:
                comm_get_string += var[0] + "," + paired_params[var[0]][0] + ","
        else:
            if var[0] in paired_params.keys():
                search_params = var[0]  + "," + paired_params[var[0]][0]
            else: 
                search_params = var[0]

            get_string += search_params + ","
    
    if get_string != "" and get_string[-1] == ",":
        get_string = get_string[:-1]
    if comm_get_string != "" and comm_get_string[-1] == ",":
        comm_get_string = comm_get_string[:-1]

    #make the API call and get ALL of the results
    remaining_cols = []
    commodity_cols = []
    if get_string != "":
        print("Starting major API call: ", time.time() - startTime)
        try: 
            response = requests.get(apiUrl + exp + "/" + dataset + "?get=" + get_string + time_string + keyString)
            print("API CALL: ", apiUrl + exp + "/" + dataset + "?get=" + get_string + time_string + keyString)
            response.raise_for_status()
            remaining_cols = response.json()
        except Exception as e:
            e_message =  f'An error accessing the Census API occured: {e}'
            output = jsonify({'error': e_message})
            output.headers.add('Access-Control-Allow-Origin', '*')
            return output, 500
        print("Ending major API call: ", time.time() - startTime)

    #making commodity API call -- we split this up to avoid overloading the API because the commodities are usually the vars with the most options
    # this also allows us to identify which params have options later on, because the comm params 
    # will never have values
    print("Starting comm API call: ", time.time() - startTime)
    if comm_get_string != "":
        try: 
            response = requests.get(apiUrl + exp + "/" + dataset + "?get=" + comm_get_string + time_string + keyString)
            response.raise_for_status()
            commodity_cols = response.json()
        except Exception as e:
            e_message =  f'An error accessing the Census API occured: {e}'
            output = jsonify({'error': e_message})
            output.headers.add('Access-Control-Allow-Origin', '*')
            return output, 500
        print("Ending comm API call: ", time.time() - startTime)
    else:
        print("No commodity codes")

    variables = [] if len(remaining_cols)  == 0 else remaining_cols[0] 
    var_index = dict()
    #to avoid additional searches for each variable's column
    for i, var in enumerate(variables):
        var_index[var] = i
    
    com_var_index = dict()
    com_variables = [] if len(commodity_cols)  == 0 else commodity_cols[0] 
    #to avoid additional searches for each variable's column
    for i, var in enumerate(com_variables):
        com_var_index[var] = i

    """
    second round through each variable, now formatting the result from the API into the all_params list.
    The API call returns a dataset with each column representing a different variable, and the resulting options 
    repeated for each date. This process identifies the options (non-repeating) for each variable and formats them.
    """
    for var in result:
        if var[0] not in done_vars:
            print("VAR in second round: ", var[0:2])
            shown_name = var[0:2]
            
            #Adding the paired param to shown values, so the dropdown will show in the form "E_COMMOD (E_COMMOD_SDESC)"
            if var[0] in paired_params.keys():
                var_name = shown_name[0]
                desc = shown_name.pop() #last elem and removing it
                shown_name = [var_name, paired_params[var[0]][0], desc]

            #getting all options for the given variable
            cur_cols = remaining_cols if var[0] in variables else commodity_cols
            cur_var_index = var_index if var[0] in variables else com_var_index

            opt_indices = [cur_var_index[var[0]]]
            if var[0] in paired_params: opt_indices.append(cur_var_index[paired_params[var[0]][0]])
            opt_indices.append(cur_var_index["YEAR"])
            opt_indices.append(cur_var_index["MONTH"])

            #NOW need to check if there are multiple values for this variable, all other vars equal
            # this allows us to identify parameters that have different values for dif times/options, but 
            # don't actually have multiple selections
            other_vars = [i for i in range(len(cur_cols[0])) if i not in opt_indices]
            options = []
            test_rows = []
            hasOpts = False
            for row in [[row[i] for i in other_vars] for row in cur_cols]:
                if row in test_rows: #found a duplicate
                    #test_rows.append(row)
                    hasOpts = True
                    break
                test_rows.append(row)

            #if len(test_rows) != len(cur_cols): #there are multiple unique options for this parameter --> include those options!
            if hasOpts:
                options = [[row[i] for i in opt_indices] for row in cur_cols]
                options.pop(0) #removing the first entry (the label row)
                #formatting sub_params into correct form -- removing month and year
                new_opts = set()
                for opt in options:
                    new_opts.add(tuple(opt[:-2]))
                options = [list(subopt) for subopt in new_opts]
            
            #accounting for params that return total value be default, not variables
            if len(options) == 1:
                options = []
            
            ####### Now we get to the point of formatting the options, which is when the tiered param info comes in

            if var[0] in tiered_param_lengths.keys():
                lengths = tiered_param_lengths[var[0]] #used to establish tiers
                #accounting for the difference between naics and statenaics NAICS codes
                if var[0] == "NAICS" and dataset=="statenaics":
                    lengths = [2,3,4]

                opts = make_tiers(options, lengths, var[0])
                
                all_params.append({"name":  shown_name, "category": var[0], "options": opts})

            else:
                #formatting non-tiered sub_params into correct form
                opts = []
                for param in options:
                    opts.append({"name": param, "category": var[0], "options": []})

                all_params.append({"name": shown_name, "category": var[0], "options": opts})

            for opt in options:
                flat_search_params.append({"name": opt, "category": var[0]})

    ### final formatting touches on all_param ###

    #sorting by name
    def alpha(opt):
        return opt['name'][0]

    all_params = sorted(all_params, key=alpha)
    flat_search_params = sorted(flat_search_params, key=alpha)

    output = jsonify([all_params, flat_search_params])
    output.headers.add('Access-Control-Allow-Origin', '*')

    return output

"""
Takes in options (teired or not) from paired parameters 
and removes the code entry in each option, leaving just the name
e.g. [1XXX, North America] -> [North America]
"""
def pros_pair_vals(options, var):
    new_opts = []
    for item in options:
        #if len(item['options']) > 0:
        #    pros_pair_vals(item['options'], var)
        new_opts.append({'name':  item['name'][1:], 'category': var, 'options': ([] if len(item['options']) == 0 else pros_pair_vals(item['options'], var)) })
    
    return new_opts

if __name__ == '__main__':
   app.run(debug=True, port=5000)
import json
from collections import defaultdict
import requests
import functools

keyString = "&key=e1da9a37eb7e1064e772d42c26760baeb0f245a4"

"""
takes in raw option list in the form [["code", "desc"], ....]
sorts it by code and removes extraneous time columns
"""
def process_codes(options):

    total_entries = []
    te_ind = []

    #handling total_entries columns
    for i in range(len(options)):
        code = options[i][0] 
        if '-' in code:
            total_entries.append(options[i])
            te_ind.append(i)
            continue
    options = [options[i] for i in range(len(options)) if i not in te_ind]

    #sorting by code
    #print("String sorted options: ", sorted(options, key=lambda x: x[0]))
    return sorted(options, key=lambda x: x[0]), total_entries #int(x[0])

"""
Used to format tiered params. 
@param codes The unprocessed list of ALL codes for the variable
@param lengths The lengths of various tiers for this variable. E.g. codes are either 2, 4, or 6 characters long
@param var_name name of the current variable (just used for formatting)
@returns 
"""
def make_tiers(codes, lengths, var_name):
    ### checks if a key already has a category
    def key_in_keys(d, key):
        for item in d:
            if item["index"] == key:
                return True
        return False 
        
    ### recursive process of inserting each code within the correct tiered stage. We add
    # the suffixes of the code too so that we dont have to worry about ordering, and in general there will never be a 
    # code that doesn't have a larger category (e.g. 0411 will always have 04)
    def insert_code(d, code, lengths):
        if not lengths:
            return
        length = lengths[0]
        # the key is each sub-length of the code
        key = code[0][:length]

        #if the key doesn't already exist, add it
        if not key_in_keys(d, key):
            d.append({"index": key, "name": code, "category": var_name, "options": []})
        # if the key does exist and the code still has more levels of detail, repeat with the next length
        elif len(lengths) > 0 and lengths[1] <= len(code[0]):
            insert_code(next((entry["options"] for entry in d if entry["index"] == key)), code, lengths[1:])
        else:
            return

    nested_structure = []

    proc_codes, total_entries = process_codes(codes)

    #adding the total entries to nested_strcture so they're at the top
    for ent in total_entries:
        nested_structure.append({"index": "", "name": ent, "category": var_name, "options": []})

    #adding the rest of the codes
    for code in proc_codes:
        insert_code(nested_structure, code, lengths)

    print("ending make_tiers")
    return nested_structure

"""
Processes countries into continents, labeled "<1 through 7>XXX"
Regions ("000<some number>") and total values are left independent.
All other countries are classified under a continent based on first digit. 
"""
def getCountryJSON(apiCall):

    #retreiving list of all country code and name options
    response = requests.get(apiCall)
    options = response.json()
    flat_options = []

    #removing duplicates and trimming off the time columns
    options = functools.reduce(lambda re, x: re+[x[:len(x)-2]] if x[:len(x)-2] not in re else re, options, [])

    countries = [] #list of name, category, options dicts

    #getting all the continent, total, and region codes (and flat params for searching) first
    for opt in options:
        if opt[0] == "CTY_CODE": #label row --> ignore
            continue
        if 'X' in opt[0] or '-' in opt[0] or opt[0][0] == '0':
            #continent, total, or region, add it as a new name
            countries.append({"name": opt, "category": "CTY_CODE", "options": []})
        flat_options.append({"name": opt, "category": "CTY_CODE"})

    #then iterating through and assigning the rest to a continent
    for opt in options:
        if opt[0] == "CTY_CODE" or 'X' in opt[0] or '-' in opt[0] or opt[0][0] == '0':
            continue
        else:
            #all other 4-dig strings (aka individual countries)
            cont = opt[0][0]
            ind = [i for i in range(len(countries)) if countries[i]["name"][0] == (cont + "XXX")][0]
            countries[ind]["options"].append({"name": opt, "category": "CTY_CODE", "options": []})
    
    return countries, flat_options


"""
Python version of getTimeString from frontend. 
Takes in a start and an end in the from YEAR-MONTH
and processes it into a string to add to the overall API call
"""
def getTimeString(start, end):

    startYear, startMonth = (int(i) for i in start.split('-'))
    endYear, endMonth = (int(i) for i in end.split('-'))

    year = startYear
    month = startMonth
    fullString = '&YEAR=' + str(startYear)

    while year < endYear or (year == endYear and month <= endMonth):
        fullString += '&MONTH=' + (str(month) if month >= 10 else "0" + str(month))
        month += 1
        if month > 12:
            month = 1
            year+= 1
            if year == endYear:
                fullString += "&YEAR=" + str(year)

    return fullString
#!/bin/bash

# Written by Ye, NICT, Kyoto, Japan
# How to run: time bash ./run-pbsmt.sh 

# after running this script, you will get baseline/ folder 
perl ./generate_configs.pl

# start running PBSMT
nohup time perl ./run-baseline.pl
#perl ./run-baseline.pl

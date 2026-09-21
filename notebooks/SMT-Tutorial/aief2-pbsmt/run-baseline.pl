#!/usr/bin/perl
use strict;
use warnings;

require IPC::System::Simple;
use autodie qw(:all);

# Written by Finch-san and Ye
# We used this script for running our NAACL paper:
# Ye Kyaw Thu, Andrew Finch and Eiichiro Sumita, 
# "Interlocking Phrases in Phrase-based Statistical Machine Translation",
# In Proceedings of the NAACL-HLT 2016, June 12-17, San Diego, US, pp. 1076-1081.

# Last updated 9 Oct 2019, @Machine Translation Research Summer School, YTU, Myanmar

# You have to update following path!!!

#my @configs = `find /home/ros/experiment/langacq/exp1/smt/{baseline,osm,hiero} -name "config.*" | sort`;
#my @configs = `find /home/ros/experiment/langacq/exp2a/smt/*/ -name "config.*.*" | sort`;
#my @configs = `find /home/ros/experiment/sl-my/smt1/*/ -name "config.baseline.*" | sort`;
#my @configs = `find /home/ros/experiment/my-rk/smt1/*/ -name "config.baseline.*" | sort`;
#my @configs = `find /media/lar/Transcend/exp/kachin-myanmar/demo-mykc-smt/ -name "config.baseline"  `;
#my @configs = `find /home/lar/experiment/kachin-myanmar/demo-mykc-smt/*/ -name "config.baseline*" | sort`;
#my @configs = `find /media/lar/Transcend/student/lecture/mtrss/pbsmt-demo/pbsmt/*/ -name "config.baseline*" | sort`;

my @configs = `find /home/ye/exp/SMT-NMT_tutorial/aief2-pbsmt/*/ -name "config.baseline*" | sort`;

#for debugging
#print "config files: @configs\n";
#exit;
            
#my @configs = qw(/panfs/panltg2/users/finch/expt/moses2.1/baseline/zh-nl/config.baseline.zh-nl);
#my @langs = qw/mini_en mini_ja/;

foreach my $i (0..$#configs)
{
	# sleep until there are less than 40 of my jobs on the queue
	#while(`qstat | grep ye | wc` =~ /^\s*([0-9]+)/ && $1 > 700 )
	#{
    	#	sleep 20;
	#}

#	my $o_config = $o_configs[$i];
#	my $b_config = $b_configs[$i];
	my $config = $configs[$i];

#	chomp $o_config;
#	chomp $b_config;
	chomp $config;

	my @toks = split /\./, $config;
	my $jobName = "$toks[$#toks]-$toks[$#toks - 1]";

	print "$jobName $config\n";

	#	`/home/lar/tool/moses/scripts/ems/experiment.perl -config $config -exec -no-graph 2>&1 | tee -a run1.log`;
       
#/home/ye/tool/mosesbin/ubuntu-17.04/moses/scripts/ems       
	`/home/ye/tool/mosesbin/ubuntu-17.04/moses/scripts/ems/experiment.perl -config $config -exec -no-graph 2>&1 | tee -a run1.log`;
	#`/home/ros/mosesdecoder/scripts/ems/experiment.perl -config $config -exec -no-graph`;
	
#	my @toks = split /\./, $o_config;
#	my $jobName = "$toks[$#toks]-$toks[$#toks - 1]";
#
#	print "$jobName $o_config\n";
#
#	`qsub -q mt128 -N "$jobName" -- /panfs/panltg2/users/finch/local/mosesdecoder.v21/scripts/ems/experiment.perl -config $o_config -exec`;
#	
#	@toks = split /\./, $b_config;
#	$jobName = "$toks[$#toks]-$toks[$#toks - 1]";
#
#	print "$jobName $b_config\n\n";
#
#	`qsub -q mt128 -N "$jobName" -- /panfs/panltg2/users/finch/local/mosesdecoder.v21/scripts/ems/experiment.perl -config $b_config -exec`;
}

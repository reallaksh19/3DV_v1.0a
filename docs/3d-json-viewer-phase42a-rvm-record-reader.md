# 3D Json Viewer Phase 4.2A RVM Record Reader

This phase adds the first bounded RVM record-reader evidence layer. It is binary evidence work only and does not implement code 4 decoding, code 11 decoding, real GAS/RMSS compatibility, stage-model generation, render-plan generation, or geometry chunks.

## Why record-reader layer is needed before code 4/code 11 decoding

Code 4 and code 11 decoding need reliable byte-range evidence before any native payload interpretation. A record-reader layer separates raw bounded byte observations from parser semantics so later decoder agents can consume explicit PRIM payload slices instead of rescanning bytes or guessing record envelopes.

## Diagnostics scanner vs record reader

The diagnostics scanner gives broad conservative counts and warnings. The record reader gives reusable low-level evidence: candidate record ranges, candidate native codes, bounded PRIM payload slices, and container-stack balance. It still does not confirm true RVM record structure.

## Candidate records vs confirmed records

A candidate record is a bounded observation that looks like a known signature such as CNTB, CNTE, PRIM, or BBOX. A confirmed record would require stronger structural proof that is outside this phase. Therefore `confirmedRecords.total` remains zero.

## Why no stage model is produced

This layer is not parser success. It does not create a stage model, manifest, render plan, component assembly, geometry chunk, or visual object. Its output is a report only.

## How future GAS/RMSS diagnostics should use this

Future GAS/RMSS diagnostics can compare scanner counts with record-reader evidence. Decoder phases can use bounded PRIM payload slices as input evidence before attempting code 4 or code 11 decoding.

## Old RVM Viewer modules remain forbidden

The record reader is independent of old viewer parser, bridge, renderer, and hotfix modules. It also avoids UI, render, style, browser cache, and browser 3D library dependencies.

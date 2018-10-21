'use strict';

import * as vscode from 'vscode';

import * as fs from 'fs';
import * as path from 'path';

import * as readYaml from 'read-yaml';
import { BuildkiteStatusController } from './buildkite-ci';

export function activate(context: vscode.ExtensionContext) {
    let buildkiteController: BuildkiteStatusController;
    let settings = isConfigured();

    if (settings) {
        initBuildkiteStatus(context, settings);
    }

    context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders(e => {
        settings = isConfigured();
        if (settings) {
            initBuildkiteStatus(context, settings);
        }
    }));

    let updateStatusDisp = vscode.commands.registerCommand("buildkite.updateStatus", () => updateBuildkiteStatus(false));
    context.subscriptions.push(updateStatusDisp);

    let openInBuildkiteDisp = vscode.commands.registerCommand("buildkite.viewInBuildkite", () => openInBuildkite());
    context.subscriptions.push(openInBuildkiteDisp);

    const pollInterval: number = vscode.workspace.getConfiguration("buildkiteci").get("pollInterval", 0);
    
    let interval = 20000;

    if (pollInterval > 0) {
        interval = pollInterval * 60000;
    }

    if (settings) {
        setInterval(updateBuildkiteStatus, interval);
    }

    function initBuildkiteStatus(aContext: vscode.ExtensionContext, settings: any) {
        // Read settings from the configuration file
        buildkiteController = new BuildkiteStatusController(
            settings['token'],
            settings['organization'],
            settings['project']
        );


        // Add to the list of disposables which are disposed when the extension is deactivated
        aContext.subscriptions.push(buildkiteController);
    };

    function updateBuildkiteStatus(silent?: boolean) {
        if (!!settings) {
            buildkiteController.update();
            return;
        } 

        if (!silent) {
            vscode.window.showErrorMessage("The Buildkite configuration file .buildkite-ci-status.yml not found.");
        }
    };

    function openInBuildkite() {
        if (!!settings) {
            buildkiteController.openWeb();
        } else {
            vscode.window.showErrorMessage("The Buildkite configuration file .buildkite-ci-status.yml not found.");            
        }
    }
}

export function deactivate() {
}

/**
 * Checks whether or not the configuration .buildkite-ci.yml file exists
 * in current workspace.
 */
function isConfigured(): any {
    if (!vscode.workspace.workspaceFolders) {
        return undefined;
    }

    let exists: any = false;
    for (const workspaceItem of vscode.workspace.workspaceFolders) {
        exists = fs.existsSync(path.join(workspaceItem.uri.fsPath, ".buildkite-ci-status.yml"));
        if (exists) {
            return readYaml.sync(path.join(workspaceItem.uri.fsPath, ".buildkite-ci-status.yml"));
        }
    }

    return undefined;
}

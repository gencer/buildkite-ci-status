'use strict';

import { window, Disposable, StatusBarItem, StatusBarAlignment } from 'vscode';

import * as open from 'open';
import { RxHR } from '@akanass/rx-http-request';
import * as request from "request-promise-native";
var emoji = require('node-emoji')

export class BuildkiteStatusController {
    private _buildkite: BuildkiteStatus;
    private _disposable: Disposable;

    constructor(authToken: string, organizationId: string, project: string) {
        this._buildkite = new BuildkiteStatus(authToken, organizationId, project);

        let subscriptions: Disposable[] = [];

        // Update the current status
        this._buildkite.updateIndicator();

        // Create a combined disposable from both event subscriptions
        this._disposable = Disposable.from(...subscriptions);
    }

    dispose() {
        this._disposable.dispose();
    }

    update() {
        this._buildkite.updateIndicator();
    }

    openWeb() {
        this._buildkite.openWeb();
    }

    async openResult(panel: any) {
        return this._buildkite.openResult(panel);
    }

    private _onEvent() {
        this._buildkite.updateIndicator();
    }
}
class BuildkiteStatus {
    private _indicator: StatusBarItem;
    private _project: string;
    private _organization: string;
    private _token: string;
    private _webUrl: string;

    constructor(authToken: string, organization: string, project: string) {
        this._project = project;
        this._organization = organization;
        this._token = authToken;
        this._webUrl = "https://buildkite.com"
    }

    public updateIndicator() {
        if (!this._indicator) {
            this._indicator = window.createStatusBarItem(StatusBarAlignment.Left);
            this._indicator.command = 'buildkite.viewInBuildkite';
        }

        var options = {
            headers: {
                'Authorization': 'Bearer ' + this._token
            },
            json: true
        };

        RxHR.get('https://api.buildkite.com/v2/organizations/' + this._organization + '/pipelines/' + this._project + '/builds', options).subscribe(
            (data) => {
                if (data.response.statusCode === 200) {
                    this._setSuccessfulIndicatorText(data.body[0].number, data.body[0].state);
                    this._webUrl = data.body[0].web_url;
                } else {
                    this._setUnsuccessfulIndicatorText(data.response.statusCode)
                }
            },
            (err) => {
                this._setUnsuccessfulIndicatorText(400);
            }
        );


        this._indicator.show();
    }

    public openWeb() {
        open(this._webUrl);
    }


    public async openResult(panel: any) {

        var options = {
            headers: {
                'Authorization': 'Bearer ' + this._token
            },
            json: true
        };

        const onMissing = (name)  => {
            return ":" + name + ":";
        };

        RxHR.get('https://api.buildkite.com/v2/organizations/' + this._organization + '/pipelines/' + this._project + '/builds', options).subscribe(
            async (data) => {
                if (data.response.statusCode === 200) {
                    this._setSuccessfulIndicatorText(data.body[0].number, data.body[0].state);
                    // this._webUrl = data.body[0].web_url;

                    let jobs: string = ''

                    for (let job of data.body[0].jobs) {
                        if ( job.name === undefined ) { continue }
                        const title = emoji.emojify(job.name, onMissing);
                        jobs += `<div class="job">${title}</div><br>`

                        const baseUrl = 'https://api.buildkite.com/v2/organizations/' + this._organization + '/pipelines/' + 
                                this._project + '/builds/' + data.body[0].number + '/jobs/' + job.id + '/log';
                        const queryString = '';
                        var options = {
                            uri: baseUrl + queryString,
                            headers: {
                                'Authorization': 'Bearer ' + this._token,
                                'Accept': 'text/html',
                            }
                        };
                        let result = await request.get(options);
                        jobs += `<div class="result"><code>${result.replace(/\n/gm, "<br>")}</code></div>`
                        jobs += '<br>'
                    }

                    panel.webview.html = `<!DOCTYPE html>
                        <html lang="en">
                        <head>
                            <meta charset="UTF-8">
                            <meta name="viewport" content="width=device-width, initial-scale=1.0">
                            <title>Build Result</title>
                            <style>
                                .job { 
                                    padding: 9px;
                                    width: 100%;
                                    color: #fff;
                                    font-size: 15px;
                                }
                            </style>
                        </head>
                        <body>
                            ${jobs}
                        </body>
                        </html>`;

                } else {
                    this._setUnsuccessfulIndicatorText(data.response.statusCode)
                }
            },
            (err) => {
                this._setUnsuccessfulIndicatorText(400);
            }
        );
    }

    private _setSuccessfulIndicatorText(id: number, buildStatus: string) {
        switch (buildStatus) {
            case "passed":
                this._indicator.text = "$(check) Buildkite: Build Passed (#" + id + ")";
                break;
            case "running":
                this._indicator.text = "$(zap) Buildkite: Build Running (#" + id + ")";
                break;
            case "scheduled":
                this._indicator.text = "$(clock) Buildkite: Build Scheduled (#" + id + ")";
                break;
            case "failed":
                this._indicator.text = "$(x) Buildkite: Build Failed (#" + id + ")";
                break;
            case "stopped":
                this._indicator.text = "$(stop) Buildkite: Build Stopped (#" + id + ")";
                break;
            case "pending":
                this._indicator.text = "$(watch) Buildkite: Build Pending (#" + id + ")";
                break;
        }
    }

    private _setUnsuccessfulIndicatorText(statusCode: number) {
        switch (statusCode) {
            case 401:
                this._indicator.text = "$(lock) Buildkite: Authentication required";
                break;
            case 404:
                this._indicator.text = "$(alert) Buildkite: Project not found";
                break;
            default:
                this._indicator.text = "$(alert) Buildkite: Connection error";
                break;
        }
    }

    dispose() {
        this._indicator.dispose();
    }
}

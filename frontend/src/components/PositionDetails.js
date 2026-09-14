import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Container, Row, Button } from 'react-bootstrap';
import { DragDropContext } from 'react-beautiful-dnd';
import StageColumn from './StageColumn';
import CandidateDetails from './CandidateDetails';
import { useNavigate } from 'react-router-dom';

const PositionsDetails = () => {
    const { id } = useParams();
    const [stages, setStages] = useState([]);
    const [positionName, setPositionName] = useState('');
    const [selectedCandidate, setSelectedCandidate] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        const loadPositionBoard = async () => {
            try {
                const [flowResponse, candidatesResponse] = await Promise.all([
                    fetch(`http://localhost:3010/positions/${id}/interviewflow`),
                    fetch(`http://localhost:3010/positions/${id}/candidates`)
                ]);
                if (!flowResponse.ok || !candidatesResponse.ok) {
                    throw new Error('Error loading position details');
                }
                const flowData = await flowResponse.json();
                const candidates = await candidatesResponse.json();
                const interviewSteps = flowData.interviewFlow.interviewFlow.interviewSteps.map(step => ({
                    title: step.name,
                    id: step.id,
                    candidates: candidates
                        .filter(candidate => candidate.currentInterviewStep === step.name)
                        .map(candidate => ({
                            id: candidate.candidateId.toString(),
                            name: candidate.fullName,
                            rating: candidate.averageScore,
                            applicationId: candidate.applicationId
                        }))
                }));
                setStages(interviewSteps);
                setPositionName(flowData.interviewFlow.positionName);
            } catch (error) {
                console.error('Error loading position details:', error);
            }
        };

        loadPositionBoard();
    }, [id]);

    const updateCandidateStep = async (candidateId, applicationId, newStep) => {
        try {
            const response = await fetch(`http://localhost:3010/candidates/${candidateId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    applicationId: Number(applicationId),
                    currentInterviewStep: Number(newStep)
                })
            });

            if (!response.ok) {
                throw new Error('Error updating candidate step');
            }
        } catch (error) {
            console.error('Error updating candidate step:', error);
            throw error;
        }
    };

    const cloneStages = (currentStages) =>
        currentStages.map((stage) => ({
            ...stage,
            candidates: [...stage.candidates]
        }));

    const onDragEnd = (result) => {
        const { source, destination } = result;

        if (!destination) {
            return;
        }

        if (source.droppableId === destination.droppableId && source.index === destination.index) {
            return;
        }

        const snapshot = cloneStages(stages);
        const nextStages = cloneStages(stages);
        const sourceStage = nextStages[Number(source.droppableId)];
        const destStage = nextStages[Number(destination.droppableId)];

        const [movedCandidate] = sourceStage.candidates.splice(source.index, 1);
        destStage.candidates.splice(destination.index, 0, movedCandidate);

        setStages(nextStages);

        updateCandidateStep(movedCandidate.id, movedCandidate.applicationId, destStage.id).catch(() => {
            setStages(snapshot);
        });
    };

    const handleCardClick = (candidate) => {
        setSelectedCandidate(candidate);
    };

    const closeSlide = () => {
        setSelectedCandidate(null);
    };

    return (
        <Container className="mt-5">
            <Button variant="link" onClick={() => navigate('/positions')} className="mb-3">
                Volver a Posiciones
            </Button>
            <h2 className="text-center mb-4" data-testid="position-title">{positionName}</h2>
            <DragDropContext onDragEnd={onDragEnd}>
                <Row>
                    {stages.map((stage, index) => (
                        <StageColumn key={index} stage={stage} index={index} onCardClick={handleCardClick} />
                    ))}
                </Row>
            </DragDropContext>
            <CandidateDetails candidate={selectedCandidate} onClose={closeSlide} />
        </Container>
    );
};

export default PositionsDetails;

